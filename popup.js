// Popup script for Beaver Assistant
let isListening = false;
let contentScriptReady = false;

document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyButton = document.getElementById('saveKey');
  const toggleVoiceButton = document.getElementById('toggleVoice');
  const summarizeButton = document.getElementById('summarize');
  const stopSpeakingButton = document.getElementById('stopSpeaking');
  const statusDiv = document.getElementById('status');

  let isListening = false;
  let isSpeaking = false;

  // Initialize popup
  initializePopup();

  // Event Listeners
  saveKeyButton.addEventListener('click', handleSaveKey);
  toggleVoiceButton.addEventListener('click', handleVoiceToggle);
  summarizeButton.addEventListener('click', handleSummarize);
  stopSpeakingButton.addEventListener('click', handleStopSpeaking);

  // Initialize popup state and check content script
  async function initializePopup() {
    try {
      // Load saved state
      const { gcpApiKey, isListening: savedState } = await chrome.storage.local.get(['gcpApiKey', 'isListening']);
      
      if (gcpApiKey) {
        apiKeyInput.value = gcpApiKey;
        enableButtons();
      }

      isListening = savedState || false;
      if (isListening) {
        updateVoiceButtonState(true);
      }

      // Check content script status
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'checkStatus' });
          contentScriptReady = true;
        } catch (error) {
          console.log('Content script not ready, injecting...');
          await injectContentScript(tab.id);
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
      updateStatus('Error initializing extension', 'error');
    }
  }

  // Inject content script if needed
  async function injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      contentScriptReady = true;
    } catch (error) {
      console.error('Script injection error:', error);
      throw new Error('Could not initialize extension on this page');
    }
  }

  // Handle API key save
  async function handleSaveKey() {
    try {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        throw new Error('Please enter an API key');
      }

      saveKeyButton.disabled = true;
      updateStatus('Validating API key...', 'info');

      // Test API key
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Test message' }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Invalid API key: ${errorData.error?.message || 'Unknown error'}`);
      }

      await chrome.storage.local.set({ gcpApiKey: apiKey });
      updateStatus('API key saved successfully!', 'success');
      enableButtons();
    } catch (error) {
      console.error('Save key error:', error);
      updateStatus(error.message, 'error');
    } finally {
      saveKeyButton.disabled = false;
    }
  }

  // Handle voice toggle
  async function handleVoiceToggle() {
    if (!contentScriptReady) {
      updateStatus('Please wait for extension to initialize...', 'error');
      return;
    }

    try {
      await validateApiKey();
      toggleVoiceButton.disabled = true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      isListening = !isListening;
      await chrome.storage.local.set({ isListening });

      // Send message to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleVoiceRecognition',
        isListening: isListening
      });

      updateVoiceButtonState(isListening);
    } catch (error) {
      console.error('Voice toggle error:', error);
      isListening = false;
      updateStatus(error.message, 'error');
      updateVoiceButtonState(false);
    } finally {
      toggleVoiceButton.disabled = false;
    }
  }

  // Handle summarize
  async function handleSummarize() {
    try {
      const apiKey = await validateApiKey();
      summarizeButton.disabled = true;
      stopSpeakingButton.style.display = 'block';
      isSpeaking = true;
      updateStatus('Summarizing page...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot summarize browser pages');
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: 'summarizePage',
        apiKey: apiKey
      });

      updateStatus('Summary requested', 'success');
    } catch (error) {
      console.error('Summarize error:', error);
      updateStatus(error.message, 'error');
      isSpeaking = false;
      stopSpeakingButton.style.display = 'none';
    } finally {
      summarizeButton.disabled = false;
    }
  }

  // Handle stop speaking
  async function handleStopSpeaking() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: 'stopSpeaking'
      });

      isSpeaking = false;
      stopSpeakingButton.style.display = 'none';
      updateStatus('Speech stopped', 'info');
    } catch (error) {
      console.error('Stop speaking error:', error);
      updateStatus(error.message, 'error');
    }
  }

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStatus') {
      updateStatus(request.message, request.type, request.isTemp);
    } else if (request.action === 'speechEnded') {
      isSpeaking = false;
      stopSpeakingButton.style.display = 'none';
    }
    return true;
  });


  // Update status message
  function updateStatus(message, type = '', isTemp = true) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'listening') {
      statusDiv.innerHTML = `${message}<div class="pulse"></div>`;
    }

    if (isTemp && type !== 'listening' && type !== 'error') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    }
  }

  // Update voice button state
  function updateVoiceButtonState(listening) {
    toggleVoiceButton.innerHTML = listening ?
      '<i class="fas fa-microphone-slash"></i> Stop Listening' :
      '<i class="fas fa-microphone"></i> Start Listening';
    
    toggleVoiceButton.className = `button${listening ? ' listening' : ''}`;
    
    if (listening) {
      updateStatus('Listening for commands...', 'listening', false);
    } else {
      updateStatus('Voice recognition stopped', 'info');
    }
  }

  // Enable buttons
  function enableButtons() {
    toggleVoiceButton.disabled = false;
    summarizeButton.disabled = false;
  }

  // Validate API key
  async function validateApiKey() {
    const { gcpApiKey } = await chrome.storage.local.get(['gcpApiKey']);
    if (!gcpApiKey) {
      throw new Error('Please save your API key first');
    }
    return gcpApiKey;
  }
});