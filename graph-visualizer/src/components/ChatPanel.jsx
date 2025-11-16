import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader } from 'lucide-react';

export default function ChatPanel({ onHighlightClaims, onHighlightCitation, selectedAsset }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeHighlightMessageId, setActiveHighlightMessageId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleToggleHighlight = (messageId, claimIds) => {
    if (activeHighlightMessageId === messageId) {
      // Turn off highlighting
      setActiveHighlightMessageId(null);
      onHighlightClaims([]);
    } else {
      // Turn on highlighting for this message
      setActiveHighlightMessageId(messageId);
      onHighlightClaims(claimIds);
    }
  };

  const handleCitationClick = (claimId) => {
    // Highlight just this specific claim with special citation color
    onHighlightCitation(claimId);
    setActiveHighlightMessageId(null);
  };

  const renderMessageWithCitations = (content, citations) => {
    if (!citations || Object.keys(citations).length === 0) {
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }

    // Split content by citation pattern [1], [2], etc.
    const parts = [];
    let lastIndex = 0;
    const citationRegex = /\[(\d+)\]/g;
    let match;

    while ((match = citationRegex.exec(content)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      // Add citation button
      const citationNum = match[1];
      const claimId = citations[citationNum];
      parts.push({
        type: 'citation',
        number: citationNum,
        claimId: claimId
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return (
      <p className="text-sm whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.content}</span>;
          } else {
            return (
              <button
                key={index}
                onClick={() => handleCitationClick(part.claimId)}
                className="inline-flex items-center justify-center w-5 h-5 mx-0.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors align-baseline"
                title={`Click to highlight claim: ${part.claimId}`}
              >
                {part.number}
              </button>
            );
          }
        })}
      </p>
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setActiveHighlightMessageId(null); // Clear any active highlights when sending new message

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          selected_asset: selectedAsset
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        citations: data.citations || {},
        highlightClaims: data.highlight_claim_ids || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${error.message}. Make sure the backend server is running on port 8000.`,
        highlightClaims: []
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveHighlightMessageId(null);
    onHighlightClaims([]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-96 flex-shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">AI Chat Assistant</h2>
          <p className="text-xs text-gray-400">Ask questions about the claims</p>
        </div>
        <button
          onClick={handleClearChat}
          className="text-gray-400 hover:text-white transition-colors"
          title="Clear chat"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-2">Ask me anything about the claims!</p>
            <p className="text-sm">Examples:</p>
            <ul className="text-xs space-y-1 mt-2">
              <li>What are people saying about NVIDIA?</li>
              <li>Tell me about Tesla's challenges</li>
              <li>Why is gold considered a safe haven?</li>
            </ul>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  renderMessageWithCitations(message.content, message.citations)
                )}
                {message.highlightClaims && message.highlightClaims.length > 0 && (
                  <button
                    onClick={() => handleToggleHighlight(message.id, message.highlightClaims)}
                    className={`mt-2 pt-2 border-t border-gray-600 text-xs w-full text-left transition-colors ${
                      activeHighlightMessageId === message.id
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-gray-300 hover:text-gray-200'
                    }`}
                  >
                    {activeHighlightMessageId === message.id ? '✓ ' : ''}
                    {activeHighlightMessageId === message.id ? 'Highlighting' : 'Click to highlight'} {message.highlightClaims.length} claim(s)
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2 flex items-center space-x-2">
              <Loader className="animate-spin" size={16} />
              <span className="text-sm text-gray-300">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 transition-colors flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
