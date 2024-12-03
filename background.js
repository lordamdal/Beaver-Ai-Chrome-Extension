// Background script for Beaver Assistant
let appState = {
  isInitialized: false,
  isListening: false,
  activeTabId: null
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  await initializeExtension();
});

// Update active tab
chrome.tabs.onActivated.addListener(({ tabId }) => {
  appState.activeTabId = tabId;
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Create a handler map for different message types
  const handlers = {
    'processCommand': handleCommand,
    'processSummary': handleSummary
  };

  // If we have a handler for this message type
  if (handlers[request.action]) {
    // Execute handler and send response
    handlers[request.action](request)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open
  }
});

// Initialize extension
async function initializeExtension() {
  try {
    // Remove existing rules
    await chrome.declarativeContent.onPageChanged.removeRules(undefined);

    // Add new rules
    await chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { schemes: ['http', 'https'] }
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);

    // Load saved state
    const { isListening } = await chrome.storage.local.get(['isListening']);
    appState.isListening = isListening || false;
    appState.isInitialized = true;

  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Handle voice commands
async function handleCommand(request) {
  const command = request.command.trim();
  const { gcpApiKey } = await chrome.storage.local.get(['gcpApiKey']);
  
  if (!gcpApiKey) {
    throw new Error('API key not found');
  }

  if (command.includes('summarize')) {
    return handleSummary(request);
  } else if (command.includes('find') || command.includes('search')) {
    return handleSearch(command, gcpApiKey);
  } else {
    return getGeneralResponse(command, gcpApiKey);
  }
}

// Handle summary requests
async function handleSummary(request) {
  try {
    const { gcpApiKey } = await chrome.storage.local.get(['gcpApiKey']);
    if (!gcpApiKey) {
      throw new Error('API key not found');
    }

    const response = await callGeminiAPI('summarize', request.content, gcpApiKey);
    return { success: true, summary: response };
  } catch (error) {
    console.error('Summary error:', error);
    throw error;
  }
}

// Handle search commands
async function handleSearch(command, apiKey) {
  try {
    const response = await callGeminiAPI('search', command, apiKey);
    const suggestions = JSON.parse(response);

    // Open suggested websites
    for (const site of suggestions) {
      await chrome.tabs.create({ url: site.url });
    }

    return { success: true, response: 'Opening suggested websites' };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

// Get general response
async function getGeneralResponse(command, apiKey) {
  try {
    const response = await callGeminiAPI('general', command, apiKey);
    return { success: true, response };
  } catch (error) {
    console.error('Response error:', error);
    throw error;
  }
}

// Call Gemini API
async function callGeminiAPI(type, content, apiKey) {
  const prompts = {
    summarize: `Provide a clear and concise summary of the following content in 3-4 sentences: ${content}`,
    search: `Based on this request: "${content}", suggest 3 relevant websites. Format as JSON array with properties: title, url.`,
    general: `Respond to this request: ${content}`
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompts[type] }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Keep service worker active
chrome.runtime.onConnect.addListener(port => {
  port.onDisconnect.addListener(() => {
    console.log('Port disconnected, keeping service worker alive');
  });
});