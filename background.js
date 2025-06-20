// Background Script for Language Learning Extension
class BackgroundService {
    constructor() {
      this.init();
    }
  
    init() {
      // Listen for extension installation
      chrome.runtime.onInstalled.addListener(() => {
        this.setupInitialData();
      });
  
      // Listen for messages from content script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      });
  
      // Reset daily session count
      this.setupDailyReset();
    }
  
    async setupInitialData() {
      try {
        const result = await chrome.storage.local.get(['vocabList', 'sessionCount', 'lastResetDate']);
        
        // Initialize empty vocabulary list if it doesn't exist
        if (!result.vocabList) {
          await chrome.storage.local.set({ vocabList: [] });
        }
  
        // Initialize session count
        if (!result.sessionCount) {
          await chrome.storage.local.set({ sessionCount: 0 });
        }
  
        // Set initial reset date
        if (!result.lastResetDate) {
          await chrome.storage.local.set({ lastResetDate: new Date().toDateString() });
        }
  
        console.log('Language Learning Extension initialized');
      } catch (error) {
        console.error('Failed to setup initial data:', error);
      }
    }
  
    async handleMessage(message, sender, sendResponse) {
      switch (message.type) {
        case 'LOOKUP_WORD':
          await this.handleWordLookup(message.word, sendResponse);
          break;
        
        case 'ADD_TO_VOCAB':
          await this.handleAddToVocab(message.wordData, sendResponse);
          break;
        
        case 'GET_VOCAB_LIST':
          await this.handleGetVocabList(sendResponse);
          break;
        
        case 'INCREMENT_SESSION':
          await this.incrementSessionCount(sendResponse);
          break;
        
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    }
  
    async handleWordLookup(word, sendResponse) {
      try {
        // This is where you'd integrate with a real dictionary API
        // For now, we'll use a simple lookup
        const definition = await this.lookupWord(word);
        await this.incrementSessionCount();
        
        sendResponse({ 
          success: true, 
          definition: definition 
        });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    }
  
    async lookupWord(word) {
      // Placeholder dictionary - replace with real API call
      const dictionary = {
        'hello': { definition: 'A greeting', pronunciation: 'həˈloʊ' },
        'world': { definition: 'The earth and all its inhabitants', pronunciation: 'wɜrld' },
        'language': { definition: 'A system of communication', pronunciation: 'ˈlæŋɡwɪdʒ' },
        'learn': { definition: 'To acquire knowledge or skills', pronunciation: 'lɜrn' },
        'study': { definition: 'To devote time to learning', pronunciation: 'ˈstʌdi' }
      };
  
      return dictionary[word.toLowerCase()] || null;
    }
  
    async handleAddToVocab(wordData, sendResponse) {
      try {
        const result = await chrome.storage.local.get(['vocabList']);
        const vocabList = result.vocabList || [];
        
        // Check if word already exists
        const exists = vocabList.some(item => item.word === wordData.word);
        
        if (!exists) {
          vocabList.push({
            ...wordData,
            dateAdded: new Date().toISOString(),
            reviewCount: 0
          });
          
          await chrome.storage.local.set({ vocabList: vocabList });
          
          sendResponse({ 
            success: true, 
            message: 'Word added to vocabulary' 
          });
        } else {
          sendResponse({ 
            success: false, 
            message: 'Word already in vocabulary' 
          });
        }
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    }
  
    async handleGetVocabList(sendResponse) {
      try {
        const result = await chrome.storage.local.get(['vocabList']);
        sendResponse({ 
          success: true, 
          vocabList: result.vocabList || [] 
        });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    }
  
    async incrementSessionCount(sendResponse) {
      try {
        const result = await chrome.storage.local.get(['sessionCount']);
        const newCount = (result.sessionCount || 0) + 1;
        
        await chrome.storage.local.set({ sessionCount: newCount });
        
        if (sendResponse) {
          sendResponse({ 
            success: true, 
            sessionCount: newCount 
          });
        }
      } catch (error) {
        if (sendResponse) {
          sendResponse({ 
            success: false, 
            error: error.message 
          });
        }
      }
    }
  
    async setupDailyReset() {
      // Check if we need to reset daily counters
      const checkAndReset = async () => {
        try {
          const result = await chrome.storage.local.get(['lastResetDate', 'sessionCount']);
          const today = new Date().toDateString();
          
          if (result.lastResetDate !== today) {
            await chrome.storage.local.set({
              sessionCount: 0,
              lastResetDate: today
            });
            console.log('Daily session count reset');
          }
        } catch (error) {
          console.error('Failed to reset daily counters:', error);
        }
      };
  
      // Check immediately
      await checkAndReset();
  
      // Set up alarm to check daily
      chrome.alarms.create('dailyReset', { 
        delayInMinutes: 1, 
        periodInMinutes: 60 * 24 
      });
  
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'dailyReset') {
          checkAndReset();
        }
      });
    }
  }
  
  // Initialize background service
  new BackgroundService();