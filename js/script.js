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

    // Store the rental catalog as model context once it loads.
    let rentalsContext = 'No rental data is available right now.';

    // Keep the conversation history so we can send the full chat to OpenAI.
    const conversation = [
        {
            role: 'system',
            content: 'You are Offbeat Assistant for a vacation rental website. Be friendly, concise, and helpful.'
        },
        {
            role: 'assistant',
            content: 'Hello! How can I help you find your perfect offbeat retreat?'
        }
    ];

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
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }

    // Turn the rentals data into a short, readable summary for the model.
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
            rentalsContext = formatRentalsContext(data.rentals || []);
        } catch (error) {
            console.error(error);
        }
    }

    // Send the full conversation to OpenAI and return the assistant's reply.
    async function getAssistantReply() {
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
                        content: `Use the rental catalog below when recommending properties. Only suggest rentals from this list.\n\nRental catalog:\n${rentalsContext}`
                    }
                ].concat(conversation.slice(1)),
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error('OpenAI request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    // Handle user input and process messages.
    async function handleUserInput(e) {
        e.preventDefault();

        const message = userInput.value.trim();

        if (!message) {
            return;
        }

        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            addMessage('Please add your OpenAI API key to js/secrets.js first.', 'bot');
            return;
        }

        userInput.value = '';
        userInput.disabled = true;

        // Save and show the user's message.
        conversation.push({ role: 'user', content: message });
        addMessage(message, 'user');

        // Show a temporary loading message while the API request runs.
        const loadingMessage = addMessage('Thinking...', 'bot');

        try {
            const assistantReply = await getAssistantReply();
            conversation.push({ role: 'assistant', content: assistantReply });
            loadingMessage.textContent = assistantReply;
        } catch (error) {
            console.error(error);
            loadingMessage.textContent = 'Sorry, I could not get a response right now. Please try again.';
        } finally {
            userInput.disabled = false;
            userInput.focus();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Listen for form submission.
    chatForm.addEventListener('submit', handleUserInput);

    // Load the rental data before the user starts chatting.
    loadRentalsData();
}

// Initialize the chat interface.
initChat();
