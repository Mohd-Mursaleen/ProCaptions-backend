# ProCaptions - Frontend

This is the Next.js TypeScript frontend for ProCaptions, a tool to add dramatic text overlays to images.

## Features

- Image upload with drag and drop
- Text editing with font selection
- Font size preview and selection system
- Position text by clicking on the image
- Real-time preview of the final result

## Getting Started

### Prerequisites

- Node.js 14+ and npm/yarn
- Backend API running (see main project README)

### Installation

1. Install dependencies:

```bash
cd frontend
npm install
# or
yarn install
```

2. Configure environment variables by creating a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Adjust the URL to match your backend server.

3. Start the development server:

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── api/               # API client functions
├── components/        # Reusable UI components
├── pages/             # Next.js pages
│   └── index.tsx      # Main application page
├── types/             # TypeScript interfaces
└── public/            # Static files
```

## Key Components

### ImageUploader

Provides drag-and-drop functionality for uploading images. Uses `react-dropzone` for handling file uploads.

### DramaticTextEditor

Controls for editing text, selecting fonts, and adjusting font size. Includes a visual font size selection system that shows previews of different sizes.

### ImagePreview

Displays the current state of the image with text overlay. Allows clicking on the image to position the text.

## Building for Production

```bash
npm run build
# or
yarn build
```

Then, start the production server:

```bash
npm start
# or
yarn start
```

## Technologies Used

- Next.js
- TypeScript
- TailwindCSS
- Axios
- React Dropzone 