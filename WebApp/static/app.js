const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatContainer = document.getElementById("chat-container");
const typingIndicator = document.getElementById("typing-indicator");
const themeToggle = document.getElementById("theme-toggle");

// Send message on Enter
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

sendBtn.addEventListener("click", sendMessage);

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
});

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(content, sender, animate = false) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const time = document.createElement("div");
    time.classList.add("timestamp");
    time.textContent = formatTime();

    message.appendChild(bubble);
    message.appendChild(time);
    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (animate && sender === "vira") {
        // Animate the full HTML content (including tags)
        let index = 0;
        const typingSpeed = 10;
        const interval = setInterval(() => {
            bubble.innerHTML = content.slice(0, index) + "<span class='cursor'>|</span>";
            index++;
            if (index > content.length) {
                clearInterval(interval);
                bubble.innerHTML = content; // Final render without cursor
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, typingSpeed);
    } else {
        if (sender === "vira") {
            bubble.innerHTML = content; // Allow HTML
        } else {
            bubble.textContent = content; // Plain text for user input
        }
    }
}


function showTyping() {
    typingIndicator.classList.remove("hidden");
}

function hideTyping() {
    typingIndicator.classList.add("hidden");
}

function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    userInput.value = "";
    showTyping();

    fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
    })
    .then(res => res.json())
    .then(data => {
        hideTyping();
        appendMessage(data.response, "vira", true);  // true = animate
    })
    .catch(err => {
        hideTyping();
        appendMessage("Sorry, something went wrong.", "vira");
        console.error(err);
    });
}

