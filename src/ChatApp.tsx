import { useState, useRef, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

// Types
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface DocumentItem {
  name: string;
  type: string;
  content: string;
}

interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  documents: DocumentItem[];
  timestamp: string;
}

const ChatApp = () => {
  const [apiKey, setApiKey] = useState<string>(() => {
    const storedApiKey = localStorage.getItem("chatAppApiKey");
    return storedApiKey || "";
  });
  const [message, setMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => {
    const storedSavedChats = localStorage.getItem("chatAppSavedChats");
    if (storedSavedChats) {
      try {
        return JSON.parse(storedSavedChats) as SavedChat[];
      } catch (error) {
        console.error(
          "Failed to parse saved chats from localStorage on init:",
          error
        );
        // Optionally, clear corrupted data: localStorage.removeItem("chatAppSavedChats");
        return [];
      }
    }
    return [];
  });
  const [currentChatId, setCurrentChatId] = useState<string>("new");
  const [currentChatTitle, setCurrentChatTitle] = useState<string>("New Chat");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>("");
  const [hasSentMessage, setHasSentMessage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const MAX_RETRIES = 5;
  const INITIAL_BACKOFF_MS = 1000;

  // Effect for online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Save API key to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("chatAppApiKey", apiKey);
  }, [apiKey]);

  // Save chats to localStorage when they change
  useEffect(() => {
    localStorage.setItem("chatAppSavedChats", JSON.stringify(savedChats));
  }, [savedChats]);

  // Make sure the input fields work correctly
  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log("API Key Change:", newValue);
    setApiKey(newValue);
  };

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    console.log("Message Change:", newValue);
    setMessage(newValue);
  };

  const createNewChat = () => {
    saveCurrentChat();
    setCurrentChatId("new");
    setCurrentChatTitle("New Chat");
    setChatHistory([]);
    setDocuments([]);
    setHasSentMessage(false);
  };

  const saveCurrentChat = () => {
    if (chatHistory.length > 0) {
      const chatToSave: SavedChat = {
        id: currentChatId === "new" ? Date.now().toString() : currentChatId,
        title:
          currentChatTitle ||
          (chatHistory[0]?.content
            ? chatHistory[0].content.substring(0, 30) + "..."
            : "Untitled"),
        messages: chatHistory,
        documents: documents,
        timestamp: new Date().toISOString(),
      };

      setSavedChats((prevChats: SavedChat[]) => {
        // If updating existing chat, remove the old version
        const filteredChats =
          currentChatId !== "new"
            ? prevChats.filter((chat) => chat.id !== currentChatId)
            : prevChats;
        return [chatToSave, ...filteredChats];
      });

      if (currentChatId === "new") {
        setCurrentChatId(chatToSave.id);
      }
    }
  };

  const loadChat = (chatId: string) => {
    saveCurrentChat();
    const chatToLoad = savedChats.find((chat) => chat.id === chatId);
    if (chatToLoad) {
      setCurrentChatId(chatToLoad.id);
      setCurrentChatTitle(chatToLoad.title);
      setChatHistory(chatToLoad.messages);
      setDocuments(chatToLoad.documents || []);
      setHasSentMessage(chatToLoad.messages && chatToLoad.messages.length > 0);
    }
  };

  const deleteChat = (
    chatId: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    setSavedChats((prevChats: SavedChat[]) =>
      prevChats.filter((chat) => chat.id !== chatId)
    );
    if (currentChatId === chatId) {
      createNewChat();
    }
  };

  const updateChatTitle = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrentChatTitle(e.target.value);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);

    // Read file contents
    const filesWithContent = newFiles.map((file) => {
      return new Promise<DocumentItem>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            type: file.type,
            content:
              typeof event.target?.result === "string"
                ? event.target.result.substring(0, 3000)
                : "",
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(filesWithContent).then((processedFiles) => {
      setDocuments((prev) => [...prev, ...processedFiles]);
    });
  };

  const handleManualTextSubmit = () => {
    if (manualText.trim()) {
      const manualDoc: DocumentItem = {
        name: `Manual text (${new Date().toLocaleTimeString()})`,
        type: "text/plain",
        content: manualText.substring(0, 3000),
      };
      setDocuments((prev) => [...prev, manualDoc]);
      setManualText("");
      setShowTextInput(false);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((docs) => docs.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (hasSentMessage) return;
    if (!message.trim()) {
      setError("Please enter a message to send.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (documents.length === 0) {
      setError(
        "Please upload a document or input text before sending a message."
      );
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!apiKey.trim()) {
      setError("Please enter an API key first");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!isOnline) {
      setError(
        "No internet connection. Please check your connection and try again."
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: message };
    const context = documents.map((doc) => doc.content).join("\n\n");
    const contextMessage: ChatMessage | null = context
      ? { role: "system", content: `Context:\n${context}` }
      : null;

    // Prepare messages for the API call
    const apiMessages: ChatMessage[] = [...chatHistory];
    if (contextMessage) {
      apiMessages.push(contextMessage);
    }
    apiMessages.push(userMessage);

    setChatHistory((prev) => [...prev, userMessage]);
    setMessage(""); // Clear input field
    setIsLoading(true);
    setError(null);
    setHasSentMessage(true); // Mark that a message has been sent for this chat
    setIsRetrying(false);

    // Remove mock API call and implement real call with retry
    // try {
    //   // Mocked API call
    //   setTimeout(() => {
    //     const response = {
    //       role: "assistant",
    //       content: `This is a simulated response. Message: "${userMessage.content}" along with ${documents.length} document(s) using the provided API key.`,
    //     };
    //     setChatHistory((prev) => [...prev, response]);
    //     setIsLoading(false);
    //     saveCurrentChat();
    //   }, 1000);

    let currentTry = 0;
    while (currentTry <= MAX_RETRIES) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: apiMessages,
              temperature: 1,
              max_tokens: 1000,
              top_p: 1,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const assistantMessage = data.choices?.[0]?.message as
            | ChatMessage
            | undefined;
          if (assistantMessage) {
            setChatHistory((prev) => [...prev, assistantMessage]);
          } else {
            setError("No response from assistant.");
          }
          setIsLoading(false);
          setIsRetrying(false);
          saveCurrentChat(); // Save chat after successful response
          return; // Exit after successful attempt
        } else if (
          (response.status === 429 || response.status >= 500) &&
          currentTry < MAX_RETRIES
        ) {
          const errorData = await response.json().catch(() => ({}));
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, currentTry);
          setError(
            `API request failed (status ${response.status}${
              errorData.error?.message ? `: ${errorData.error.message}` : ""
            }). Retrying in ${delay / 1000}s... (Attempt ${
              currentTry + 1
            }/${MAX_RETRIES})`
          );
          setIsRetrying(true);
          await new Promise((resolve) => setTimeout(resolve, delay));
          currentTry++;
        } else {
          const errorData = await response
            .json()
            .catch(() => ({
              error: { message: "Failed to parse error response." },
            }));
          setError(
            `API error: ${response.status} - ${
              errorData.error?.message || "Unknown error"
            }. ${
              currentTry >= MAX_RETRIES
                ? "Max retries reached."
                : "Non-retryable error."
            }`
          );
          setIsLoading(false);
          setIsRetrying(false);
          return;
        }
      } catch (err: unknown) {
        if (currentTry < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, currentTry);
          setError(
            `Network error: ${
              err instanceof Error ? err.message : String(err)
            }. Retrying in ${delay / 1000}s... (Attempt ${
              currentTry + 1
            }/${MAX_RETRIES})`
          );
          setIsRetrying(true);
          await new Promise((resolve) => setTimeout(resolve, delay));
          currentTry++;
        } else {
          setError(
            `Network error: ${
              err instanceof Error ? err.message : String(err)
            }. Max retries reached.`
          );
          setIsLoading(false);
          setIsRetrying(false);
          return;
        }
      }
    }
    setIsLoading(false);
    setIsRetrying(false);
    if (currentTry > MAX_RETRIES) {
      setError(
        "Max retries reached. Failed to get a response from the assistant."
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold">TBI: AI-Assistant</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-100 p-4 flex flex-col border-r">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={handleApiKeyChange}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter your API key"
            />
          </div>

          {/* Saved Chats */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Saved Chats
              </label>
              <button
                onClick={createNewChat}
                className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                New Chat
              </button>
            </div>
            <div className="overflow-y-auto max-h-40 mb-4">
              {savedChats.length > 0 ? (
                <ul className="space-y-2">
                  {savedChats.map((chat) => (
                    <li
                      key={chat.id}
                      onClick={() => loadChat(chat.id)}
                      className={`text-sm p-2 rounded cursor-pointer flex justify-between items-center ${
                        currentChatId === chat.id
                          ? "bg-blue-100"
                          : "bg-white hover:bg-gray-200"
                      }`}
                    >
                      <span className="truncate flex-1">{chat.title}</span>
                      <button
                        onClick={(e) => deleteChat(chat.id, e)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No saved chats</p>
              )}
            </div>
          </div>

          {/* Current Chat Title */}
          {currentChatId !== "new" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chat Title
              </label>
              <input
                type="text"
                value={currentChatTitle}
                onChange={updateChatTitle}
                onBlur={saveCurrentChat}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Chat title"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documents
            </label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Upload Document
              </button>
              <p className="text-xs text-gray-500">Or</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => setShowTextInput((v) => !v)}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                {showTextInput ? "Cancel" : "Input Text"}
              </button>
              {showTextInput && (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="p-2 border border-gray-300 rounded resize-none"
                    rows={4}
                    placeholder="Type or paste your text here..."
                  />
                  <button
                    onClick={handleManualTextSubmit}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors self-end"
                  >
                    Add as Document
                  </button>
                </div>
              )}
            </div>
          </div>

          {documents.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Uploaded Documents:
              </p>
              <ul className="space-y-2">
                {documents.map((doc, index) => (
                  <li
                    key={index}
                    className="text-sm bg-white p-2 rounded border flex justify-between items-center"
                  >
                    <span className="truncate">{doc.name}</span>
                    <button
                      onClick={() => removeDocument(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat history */}
          <div className="flex-1 p-4 overflow-y-auto">
            {!isOnline && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
                <p>No internet connection. Some features may be unavailable.</p>
              </div>
            )}
            {chatHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div>
                  <p className="mb-2 font-semibold">How to use this app:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Enter your API key in the sidebar.</li>
                    <li>
                      Upload documents or input text (max 3,000 characters per
                      text input) to analyze.
                    </li>
                    <li>
                      Type your message query below and press <b>Send</b>
                    </li>
                    <li>
                      The assistant will respond based on the provided context.
                    </li>
                    <li>
                      An internet connection is required to get responses.
                    </li>
                    <li>Only one message can be sent per chat.</li>
                    <li>
                      After receiving a response, click on the "New Chat" button
                      to save it.
                    </li>
                    <li>Click on a chat to rename it or view its details.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((chat, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg max-w-3xl ${
                      chat.role === "user"
                        ? "bg-blue-100 ml-auto"
                        : "bg-gray-100"
                    }`}
                  >
                    <p className="text-sm font-semibold mb-1">
                      {chat.role === "user" ? "You" : "Assistant"}
                    </p>
                    <p className="whitespace-pre-wrap">{chat.content}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="p-3 rounded-lg max-w-3xl bg-gray-100">
                    <p className="text-sm font-semibold mb-1">Assistant</p>
                    <p>
                      {isRetrying
                        ? `Retrying... Please wait. (${
                            error || "Attempting to reconnect..."
                          })`
                        : "Thinking..."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-4">
              <p>{error}</p>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                className="flex-1 p-2 border border-gray-300 rounded resize-none h-20"
                placeholder="Type your message here..."
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || hasSentMessage || !isOnline}
                className={`px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors self-end ${
                  (isLoading || hasSentMessage || !isOnline) &&
                  "opacity-50 cursor-not-allowed"
                }`}
              >
                Send
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-400 text-center">
              Developed by Pablo Cruz Lemini
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
