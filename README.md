# TileBattle

A minimalist tactical multiplayer game where deception is your greatest weapon. Master the 4x4 grid by outsmarting your opponent in alternating roles of Defender and Attacker.

## Features
- **Real-time Multiplayer:** Powered by Socket.io.
- **Account System:** Secure registration and login using JWT and Bcrypt.
- **Responsive UI:** A clean, monochrome aesthetic built for the web.

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file in the root directory and add your `DATABASE_URL`.

3. **Initialize Database:**
   Use the provided schema template to set up your PostgreSQL tables:
   ```bash
   psql -d your_database_name -f online/schema.sql
   ```

4. **Run the Server:**
   ```bash
   npm start
   ```
   The game will be available at `http://localhost:3000`.
