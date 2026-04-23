# Snappic Premium - Deployment & Configuration Guide

I have completely overhauled the app to give it a **Premium Instagram Experience**. Below is how you connect your MongoDB account and get it ready for deployment.

## 1. Connecting to MongoDB Atlas

Since you created your account yesterday, follow these steps to get your connection string:

1.  **Log in** to your [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account.
2.  Go to your **Database** (Cluster).
3.  Click the **Connect** button.
4.  Choose **"Drivers"** (usually under "Connect your application").
5.  Copy the connection string. It looks like this:
    `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6.  **Important:** Replace `<password>` with the password you created for your database user (not your Atlas login password).

## 2. Update your `.env` file

Open the `.env` file I created in your project folder and paste your connection string there:

```env
MONGO_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/snappic?retryWrites=true&w=majority
JWT_SECRET=snappic_premium_secret_key_2024
PORT=3000
```

## 3. New Features Added

-   **Instagram Aesthetic:** Modern typography, rounded avatars, and clean white/dark mode UI.
-   **Stories Bar:** A mock stories bar at the top of the feed.
-   **Premium Feed:** Improved post cards with double-click to like, captions, and comment summaries.
-   **Profile Experience:** A grid-based profile view just like Instagram.
-   **Dark Mode:** Toggle between light and dark themes using the moon icon.
-   **Messenger:** A sleeker direct messaging interface.
-   **Deployment Ready:** The server is now configured to handle environment variables and large image uploads.

## 4. How to Run

1.  Open your terminal in the `snappic-live` folder.
2.  Install dependencies (if not already): `npm install`.
3.  Run the app: `npm start`.
4.  Open `http://localhost:3000` in your browser.

## 5. Deployment on AWS / Render / Vercel

If you want to host this on AWS:
-   You can use **AWS Elastic Beanstalk** or **EC2**.
-   Ensure you set the **Environment Variables** (MONGO_URI, JWT_SECRET) in the AWS console.
-   Your app data is safely stored in **MongoDB Atlas** (which often runs on AWS infrastructure), so your data persists even if you restart the server.

---
**Enjoy your new Premium Snappic!**
