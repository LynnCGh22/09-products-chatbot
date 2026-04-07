// Main function to initialize the chat interface
function initChat() {
    // Get all required DOM elements
    const chatToggle = document.getElementById('chatToggle');
    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const chatForm = document.getElementById('chatForm');
    const openIcon = document.querySelector('.open-icon');
    const closeIcon = document.querySelector('.close-icon');

    // Keep the rental catalog in memory once it loads.
    let rentalsCatalog = [];
    let rentalsLoaded = false;

    // Keep the conversation history so we can send the full chat to OpenAI.
    const conversation = [
        {
            role: 'system',
            content: 'You are Offbeat Assistant for a vacation rental website. Ask 2-3 simple questions, then recommend the best matching rentals from the catalog. Use a formal, direct, business-oriented tone. Keep responses concise and format recommendations with clear line breaks or bullet points.'
        }
    ];

    // Ask a short set of questions before recommending rentals.
    const guidedQuestions = [
        {
            key: 'vibe',
            prompt: 'Please describe the experience you want: spooky, playful, cozy, magical, unusual, relaxed, or food-focused.'
        },
        {
            key: 'location',
            prompt: 'Which setting do you prefer: desert, city, mountains, or no preference?'
        },
        {
            key: 'priority',
            prompt: 'What is your top priority: highest rating, most unusual stay, or most comfortable stay?'
        }
    ];

    let currentQuestionIndex = 0;
    const userAnswers = {
        vibe: '',
        location: '',
        priority: ''
    };

    // Toggle chat visibility and swap icons.
    chatToggle.addEventListener('click', function() {
        chatBox.classList.toggle('active');
        openIcon.style.display = chatBox.classList.contains('active') ? 'none' : 'block';
        closeIcon.style.display = chatBox.classList.contains('active') ? 'block' : 'none';
    });

    // Add a message to the chat window.
    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        messageElement.style.whiteSpace = 'pre-line';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }

    function normalizeText(text) {
        return text.toLowerCase();
    }

    function getRentalTraits(rental) {
        const traits = {
            'The UFO Bungalow': ['ufo', 'alien', 'space', 'cosmic', 'desert', 'sci-fi'],
            'Haunted Loft': ['haunted', 'ghost', 'spooky', 'eerie', 'paranormal', 'salem'],
            'The Meme Mansion': ['meme', 'playful', 'funny', 'quirky', 'internet', 'city', 'tech'],
            'The Upside-Down Hacienda': ['upside-down', 'upside down', 'weird', 'unique', 'topsy-turvy', 'gravity'],
            'The Marshmallow Mansion': ['cozy', 'comfort', 'sweet', 'warm', 'soft', 'marshmallow'],
            'The Unicorn Lava Lounge': ['magical', 'unicorn', 'rainbow', 'fantasy', 'glitter', 'lava'],
            'The Procrastination Palace': ['relaxed', 'chill', 'lazy', 'slow', 'comfortable', 'mountains'],
            'The Ramen Residence': ['foodie', 'ramen', 'noodles', 'snack', 'college', 'city']
        };

        return traits[rental.name] || [];
    }

    function scoreRental(rental, answers) {
        const answerText = normalizeText(Object.values(answers).join(' '));
        let score = rental.avgRating * 10;

        const rentalText = normalizeText(`${rental.name} ${rental.description} ${rental.location}`);

        getRentalTraits(rental).forEach(function(term) {
            if (answerText.includes(term) || rentalText.includes(term)) {
                score += 20;
            }
        });

        if (answerText.includes('highest') || answerText.includes('top') || answerText.includes('best rated')) {
            score += rental.avgRating * 5;
        }

        if (answerText.includes('unusual') || answerText.includes('weird')) {
            if (rental.name === 'The UFO Bungalow' || rental.name === 'Haunted Loft' || rental.name === 'The Meme Mansion' || rental.name === 'The Upside-Down Hacienda' || rental.name === 'The Unicorn Lava Lounge') {
                score += 15;
            }
        }

        if (answerText.includes('comfortable') || answerText.includes('cozy') || answerText.includes('relaxed')) {
            if (rental.name === 'The Marshmallow Mansion' || rental.name === 'The Procrastination Palace') {
                score += 15;
            }
        }

        return score;
    }

    function getTopMatches(answers) {
        return rentalsCatalog
            .map(function(rental) {
                return {
                    rental: rental,
                    score: scoreRental(rental, answers)
                };
            })
            .sort(function(a, b) {
                return b.score - a.score;
            })
            .slice(0, 3)
            .map(function(item) {
                return item.rental;
            });
    }

    function buildLocalRecommendation(matches) {
        const lines = ['Recommended matches:', ''];

        matches.forEach(function(rental, index) {
            lines.push(`- ${index + 1}. ${rental.name}`);
            lines.push(`  Location: ${rental.location}`);
            lines.push(`  Rating: ${rental.avgRating}`);
            lines.push(`  Why it fits: ${rental.description}`);
            lines.push('');
        });

        return lines.join('\n').trim();
    }

    function formatRentalsContext(rentals) {
        return rentals.map(function(rental) {
            return `- ${rental.name} | ${rental.location} | Rating: ${rental.avgRating}\n  ${rental.description}`;
        }).join('\n');
    }

    // Load the rental catalog from rentals.json so the assistant can recommend from real data.
    async function loadRentalsData() {
        try {
            const response = await fetch('./rentals.json');
            if (!response.ok) {
                throw new Error('Failed to load rentals.json');
            }

            const data = await response.json();
            rentalsCatalog = data.rentals || [];
            rentalsLoaded = true;
        } catch (error) {
            console.error(error);
        }
    }

    function askQuestion(index) {
        const question = guidedQuestions[index];

        if (!question) {
            return;
        }

        conversation.push({
            role: 'assistant',
            content: question.prompt
        });

        addMessage(question.prompt, 'bot');
    }

    async function getAssistantReply(matches) {
        const rentalContext = formatRentalsContext(rentalsCatalog);
        const shortlist = matches.map(function(rental) {
            return `- ${rental.name} | ${rental.location} | Rating: ${rental.avgRating}`;
        }).join('\n');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    conversation[0],
                    {
                        role: 'system',
                        content: `Use the rental catalog below and the shortlisted matches to write a short, formal recommendation. Only recommend rentals from the shortlist. Use a direct, business-oriented tone and format the response with clear line breaks or bullet points.\n\nRental catalog:\n${rentalContext}\n\nShortlist:\n${shortlist}`
                    }
                ].concat(conversation.slice(1)),
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error('OpenAI request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    async function showRecommendations() {
        const loadingMessage = addMessage('Preparing your recommendations...', 'bot');
        const matches = getTopMatches(userAnswers);
        const localFallback = buildLocalRecommendation(matches);

        try {
            if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
                loadingMessage.textContent = localFallback;
                conversation.push({
                    role: 'assistant',
                    content: localFallback
                });
                return;
            }

            const assistantReply = await getAssistantReply(matches);
            conversation.push({
                role: 'assistant',
                content: assistantReply
            });
            loadingMessage.textContent = assistantReply;
        } catch (error) {
            console.error(error);
            loadingMessage.textContent = localFallback;
            conversation.push({
                role: 'assistant',
                content: localFallback
            });
        }
    }

    function handleGuidedAnswer(message) {
        const currentQuestion = guidedQuestions[currentQuestionIndex];

        if (!currentQuestion) {
            return;
        }

        userAnswers[currentQuestion.key] = message;
        conversation.push({
            role: 'user',
            content: message
        });

        currentQuestionIndex += 1;

        if (currentQuestionIndex < guidedQuestions.length) {
            askQuestion(currentQuestionIndex);
            return;
        }

        showRecommendations();
    }

    // Start the guided conversation.
    function startGuidedFlow() {
        addMessage('I can match you to a rental in 3 quick questions.', 'bot');
        askQuestion(0);
    }

    // Handle user input and process messages.
    async function handleUserInput(e) {
        e.preventDefault();

        const message = userInput.value.trim();

        if (!message) {
            return;
        }

        userInput.value = '';
        userInput.disabled = true;

        addMessage(message, 'user');

        if (!rentalsLoaded) {
            addMessage('I am still loading the rental list. Please try again in a moment.', 'bot');
            userInput.disabled = false;
            return;
        }

        if (currentQuestionIndex < guidedQuestions.length) {
            handleGuidedAnswer(message);
        } else {
            currentQuestionIndex = 0;
            userAnswers.vibe = '';
            userAnswers.location = '';
            userAnswers.priority = '';
            addMessage('Let’s start over.', 'bot');
            askQuestion(0);
        }

        userInput.disabled = false;
        userInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Listen for form submission.
    chatForm.addEventListener('submit', handleUserInput);

    // Load the rental data before the user starts chatting.
    loadRentalsData().then(function() {
        startGuidedFlow();
    });
}

// Initialize the chat interface.
initChat();
