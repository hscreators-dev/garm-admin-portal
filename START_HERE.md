# ▶ Start Garm — the simple way (no MongoDB, no setup)

You don't need to know anything about MongoDB, servers, or code. Three simple steps:

## 1. Install Docker Desktop (one time, free)
Download and install it, then **open the app once** and wait for the little whale icon to stop moving:
👉 https://www.docker.com/products/docker-desktop/

## 2. Double-click the launcher
- **Mac:** double-click **`start-garm.command`**
  (If Mac blocks it: right-click → Open → Open. Or in Terminal run `bash start-garm.command`.)
- **Windows:** double-click **`start-garm.bat`**

A window opens and sets everything up automatically — including its own database. The **first time takes a few minutes** (it's building the apps). Leave it running.

## 3. Open the app
When it says "Garm is running":
- **Customer app** → open http://localhost:8080 in your browser
- **Admin portal** → open http://localhost:8081/garm-admin-portal/

To **log in**, type any phone number or email — the verification code appears **on the screen** (this is the easy demo mode, so you don't need SMS yet).

---

### That's it
- MongoDB, both backends, and both apps all run together — you never touched a database.
- Your data is saved automatically and will still be there next time.
- **To stop:** open Docker Desktop and stop the "Garm app admin portal" stack, or run `docker compose down` in this folder.
- **To start again:** double-click the same launcher.

### When you're ready to put it on the internet (real customers)
That needs a hosting account (a server + your domain name), which only you can sign up for. When you get there, tell me **which host** you want to use and I'll give you the exact click-by-click — the app itself is already built and ready.

### Want real SMS codes / online payments instead of demo mode?
See `OTP_SETUP.md` (SMS/email) and `DEPLOY.md` (payments). Those need provider accounts (also only you can create), but the code is wired and waiting.
