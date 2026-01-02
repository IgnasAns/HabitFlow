# 🚀 Google Play Store Launch Guide for HabitFlow

Follow this checklist to publish your app successfully.

## 1. Prerequisites 📋
- [ ] **Google Play Developer Account** ($25 one-time fee) -> [Sign up here](https://play.google.com/console/signup)
- [ ] **Privacy Policy URL** (Required for all apps)
- [ ] **Graphics Assets** (Icon, Feature Graphic, Screenshots)
- [ ] **Signed AAB File** (We have `HabitFlow-v1.6.0-release.aab`)

---

## 2. Create the App Container 🏗️
1. Log in to [Play Console](https://play.google.com/console).
2. Click **Create app** button.
3. Fill details:
   - **App name**: `HabitFlow - Habit Tracker` (Keep it descriptive)
   - **Default language**: English (US)
   - **App or Game**: App
   - **Free or Paid**: Free
4. Accept the declarations and click **Create app**.

---

## 3. App Content Setup (The "To-Do" Dashboard) 📝
Go to the **Dashboard** and complete the "Set up your app" section. You must do these in order:

1. **Privacy Policy**: Enter your hosted URL (We can generate a template if you need one).
2. **App Access**: Functional without special access? Select "All functionality is available without special access".
3. **Ads**: Select "No, my app does not contain ads".
4. **Content Rating**: Fill the questionnaire (Habit trackers are usually Rated 3+).
   - Category: Utility/Productivity.
   - Answer "No" to violence, sexuality, etc.
5. **Target Audience**: Select "18 and over" to strictly avoid strict Kids policy reviews, OR "13+" if you want broader reach.
6. **News Apps**: Select "No".
7. **COVID-19**: Select "My app is not a publicly available COVID-19 contact tracing or status app".
8. **Data Safety**: This is tricky.
   - Does your app collect data? **Yes** (Habits, maybe basic usage).
   - Is data encrypted? **Yes** (Standard HTTPS/OS encryption).
   - Can users request deletion? **No** (Unless you have a backend server).
   - *Since this is a local-first app:* You can often say "No data collected/shared" if it stays 100% on device, but Play Store often requires disclosing "App info and performance" (Crash logs).

---

## 4. Store Listing (Your Shop Window) 🏪
Go to **Main store listing** in the side menu.

### Text
- **App name**: `HabitFlow`
- **Short description**: `Build better habits with beautiful tracking, streaks, and gamification.`
- **Full description**: (Use the draft provided below)

### Graphics
- **App icon**: Upload `assets/adaptive-icon.png` (Must be 512x512).
- **Feature graphic**: 1024x500px banner (We can generate one).
- **Phone screenshots**: Upload at least 2 screenshots (1080x1920 recommended).

---

## 5. Release Production Version 🚢
1. Go to **Production** in the side menu.
2. Click **Create new release**.
3. **App signing**: Click "Choose signing key" -> **Use Google-generated key** (Recommended).
4. **App bundles**: Upload `HabitFlow-v1.6.0-release.aab`.
   - *Note*: If Google complains about debug signing, we might need to adjust the signing. But our "Release-spec" debug keystore usually works for the initial upload if using Google Play Signing.
5. **Release Name**: `1.6.0` (Auto-filled).
6. **Release Notes**:
   ```
   🚀 Initial Release!
   - Track habits with beautiful heatmaps
   - Drag and drop ordering
   - Detailed history calendar
   - Dark mode support
   ```
7. Click **Next** -> **Start rollout to Production**.

---

## 6. Review Process ⏳
- Google will review your app. This takes **1-7 days** (usually faster for updates, slower for new apps).
- Check your email for "Action Required" or "Rejection". Common reasons:
  - Missing privacy policy element.
  - Metadata policy violation (e.g. misleading description).
  - Crashes on specific devices.

---

## 🎉 Post-Launch
Once live, ask friends to download and rate it!
