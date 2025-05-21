# Chat App

## Overview

Chat App is a React-based web application that allows users to interact with OpenAI's GPT models by providing document context. It features a clean, intuitive interface for document uploads, chat interactions, and chat history management.

## Features

- **AI-powered responses** - Leverages the OpenAI API (GPT-3.5 Turbo) to generate contextual responses
- **Document analysis** - Upload documents or input text for the AI to analyze
- **Chat history management** - Save, rename, and retrieve previous conversations
- **Offline detection** - Indicates when internet connection is lost
- **Responsive design** - Works on various device sizes
- **Local storage** - Saves API key and chat history to your browser's local storage

## Prerequisites

- Node.js (version 16.x or higher recommended)
- npm or yarn
- An OpenAI API key

## Installation

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd chat-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local server 

## Usage

1. **Enter your OpenAI API key** in the sidebar
   - Your API key is stored in your browser's local storage
   - It is never sent to any server other than OpenAI's official API

2. **Add documents for context**:
   - Click "Upload Document" to add files
   - Or click "Input Text" to manually enter text content
   - Each document/text input is limited to 3,000 characters

3. **Ask questions about your documents**:
   - Type your query in the message box
   - Press "Send" to submit
   - View the AI response based on your documents

4. **Manage your chats**:
   - Create a new chat with the "New Chat" button
   - Rename chats by editing the "Chat Title" field
   - Access previous chats from the sidebar

## Technical Details

- Built with **React 19** and **TypeScript**
- Uses **Vite** for fast development and optimized builds
- Features a responsive UI with a sidebar layout
- Implements local storage for persisting user data
- Includes error handling for network issues and API failures
- Uses retry logic for API calls to handle transient errors

## Limitations

- Only one query per chat session (by design)
- Document size limited to 3,000 characters per upload/input
- Requires internet connection for API calls
- API key must be provided by the user

## Deployment

To build for production:

```bash
npm run build
```

The production-ready files will be in the `dist` directory. You can deploy these files to any static hosting service.

To preview the production build locally:

```bash
npm run preview
```

## Docker

A Dockerfile is included for containerized deployment:

```bash
docker build -t chat-app .
docker run -p 8080:80 chat-app
```

## About

Developed by Pablo Cruz Lemini

Email: [portfedh@gmail.com](mailto:portfedh@gmail.com)
