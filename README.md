# Event Check-in App

A modern React-based web application for event check-in with support for QR codes, NFC, and manual entry. Integrated with the Portal IECG API for complete event management.

## Features

- **User Authentication**: Secure login with email and password
- **Event Listing**: Browse available events for check-in
- **Multiple Check-in Methods**:
  - QR Code scanning
  - NFC tag reading
  - Manual code entry
- **Real-time Feedback**: Instant confirmation of successful check-ins
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Routing**: Wouter
- **HTTP Client**: Axios
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd portaliecg-app
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Configure environment variables:
Create a `.env.local` file in the root directory:
```env
VITE_API_URL=http://localhost:3005
```

### Development

Start the development server:
```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
# or
pnpm build
```

## Project Structure

```
client/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (Auth, Theme)
│   ├── lib/            # Utility functions and API clients
│   ├── pages/          # Page components
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # React entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── index.html          # HTML template
```

## API Integration

The application integrates with the Portal IECG API. Ensure the following endpoints are available:

### Authentication
- `POST /auth/login` - User login

### Events
- `GET /events` - List all events
- `GET /events/:id` - Get event details

### Check-in
- `POST /checkin/qrcode` - QR code check-in
- `POST /checkin/nfc` - NFC check-in
- `POST /checkin/manual` - Manual check-in

## Usage

### Login
1. Navigate to the login page
2. Enter your email and password
3. Click "Entrar" to log in

### Check-in Process
1. Select an event from the events list
2. Choose a check-in method (QR Code, NFC, or Manual)
3. Scan/read the code or enter it manually
4. Confirm the check-in

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Portal IECG API base URL | `http://localhost:3005` |

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT

## Support

For issues or questions, please contact the development team or create an issue in the repository.
