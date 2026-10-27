# Multi-Disease Prediction System

## My contributions

Predictix started from an existing open-source project (MERN app with four predictors; original authors credited in the
[LICENSE](LICENSE) and `package.json`). This repository is my extended version. What I added or changed:

**Machine learning**
- Retrained and validated the heart, diabetes and lung models with repeated stratified cross-validation, and kept the
  training scripts, dataset licences and metrics next to each model (`ML/*/train_*.py`, `*_metrics.json`).
  Heart (Cleveland): ROC-AUC 0.91. Diabetes (Pima): ROC-AUC about 0.83 to 0.84. Lung questionnaire: ROC-AUC 0.94.
- New lung CT model: ResNet-18 features with logistic regression, grouped 5-fold cross-validation on 1,901 CT images
  (97.5% accuracy), with input checks that reject non-CT uploads.
- Replaced the old breast CNN with a **fine-tuned Phikon ViT-B** (pathology foundation model) that grades breast tissue as
  **high-grade / low-grade / stroma**. TCGA validation accuracy 92.2%; on a different hospital's data (CHTN) 76.9%.
  The model stays loaded in one Python process (about 1 s per image) and its weights are downloaded automatically
  from a GitHub Release.

**Backend**
- Works without a database (local-file mode) as well as with MongoDB; OTP password reset by email; stricter auth middleware.
- Prediction history API, contact form and newsletter, safer file uploads, input validation for every predictor.
- A single Python runner for all models, with clear error messages.

**Frontend**
- 18 languages, an account page with saved prediction history, protected routes, and new About, FAQ, Contact,
  Privacy and Integration pages.
- Redesigned styling, per-field form validation, and PDF reports that also work in the production build.

**Packaging**
- One-command setup with Docker (`docker compose up --build`), including MongoDB, and a Windows launcher.

This project is a comprehensive multi-disease prediction platform designed to predict heart disease, diabetes, breast cancer, and lung cancer. Built using the MERN stack and integrated with machine learning models, Predictix offers an intuitive interface for users to input data and receive accurate health predictions, enhancing the diagnostic experience.

## Quick start (one step, Docker)

```bash
docker compose up --build
```

Open http://localhost:5173. This starts the website, the API, MongoDB and all Python models; no `.env` file is needed.
Optional settings (secrets, email OTP, breast model URL) are in `.env.example`.

The breast predictor uses a fine-tuned Phikon ViT (3-class tissue grade: high / low / stroma). Its weights are
too large for git; they are downloaded once on first use from the GitHub Release `breast-model-v1` (override with `BREAST_MODEL_URL`, a `.tar.gz` with `predictix_phikon_grade.pt` and `phikon_config/`)
Without them the other three predictors still work.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Machine Learning Models](#machine-learning-models)
- [Usage](#usage)
- [Frontend Design](#frontend-design)
- [File Structure](#file-structure)
- [Screenshots](#screenshots)
- [Future Enhancements](#future-enhancements)
- [License](#license)

## Features

- **User Authentication:** Secure sign-up and login functionality with protected routes using Context API.
- **Predictive Models:**
  - Heart disease prediction using Logistic Regression.
  - Diabetes prediction using Support Vector Machine (SVM).
  - Breast tissue grading (high-grade / low-grade / stroma) using a fine-tuned Phikon Vision Transformer.
  - Lung cancer prediction using the InceptionResNet model.
- **Image Upload for Cancer Predictions:** Users can upload medical images for breast and lung cancer detection.
- **Prescription Upload:** Automatic form filling for heart disease and diabetes predictors using regex to scan user-uploaded prescriptions.
- **Custom PDF Reports:** Generate a downloadable PDF report of prediction results.
- **Real-time Notifications:** Integrated React Toasts for user-friendly notifications.
- **Single Server Deployment:** Node.js Child Process is used to run all models, eliminating the need for a separate Flask server.

## Tech Stack

- **Frontend:** React JS (with Vite), Context API, React Toasts, Figma for design.
- **Backend:** Node.js, Express.js, Node.js Child Process for running machine learning models.
- **Database:** MongoDB (for user data and predictions).
- **Machine Learning Models:** Logistic Regression, SVM, CNN, InceptionResNet.
- **Other Libraries:** 
  - `pdf-lib` for generating custom PDF reports.
  - `multer` for file uploads (images and prescriptions).
  - `concurrently` for running client and server simultaneously.

## Machine Learning Models

- **Heart Disease Prediction:**
  - Algorithm: Logistic Regression.
  - Input Features:
    - Age, Sex, Chest Pain Type, Resting Blood Pressure, Serum Cholesterol, Fasting Blood Sugar, ECG Results, Max Heart Rate, Exercise Induced Angina, ST Depression, Peak ST Slope, Number of Vessels, Thalassemia.

- **Diabetes Prediction:**
  - Algorithm: Support Vector Machine (SVM).
  - Input Features:
    - Pregnancies, Glucose, Blood Pressure, Skin Thickness, Insulin, BMI, Diabetes Pedigree Function, Age.

- **Breast Cancer Prediction:**
  - Algorithm: Convolutional Neural Network (CNN).
  - Input: Breast tissue image.

- **Lung Cancer Prediction:**
  - Algorithm: InceptionResNet.
  - Input: Lung X-ray or CT scan image.

## Usage

1. **Sign up** or **Log in** to access the predictors.
2. Navigate to the respective disease predictor (Heart, Diabetes, Breast, Lung).
3. **For heart disease and diabetes:** Fill in the form manually or upload a prescription, and the system will auto-populate the fields using regex.
4. **For breast and lung cancer:** Upload an image (X-ray or CT scan).
5. Submit the form and view the prediction result.
6. Download the custom PDF report for future reference.

## File Structure

```bash
Predictix/
â”œâ”€â”€ Backend/                # Backend code
â”‚   â”œâ”€â”€ src/                # Source code
â”‚   â”‚   â”œâ”€â”€ controllers/    # Controller files
â”‚   â”‚   â”œâ”€â”€ DataScrapingScripts/ # Scripts for data scraping
â”‚   â”‚   â”œâ”€â”€ db/             # Database configuration
â”‚   â”‚   â”œâ”€â”€ middlewares/     # Middleware functions
â”‚   â”‚   â”œâ”€â”€ models/         # Database models
â”‚   â”‚   â”œâ”€â”€ routes/         # API route definitions
â”‚   â”‚   â”œâ”€â”€ utils/          # Utility functions
â”‚   â”‚   â”œâ”€â”€ app.js          # Main application file
â”‚   â”‚   â”œâ”€â”€ constants.js     # Constant values
â”‚   â”‚   â””â”€â”€ index.js        # Entry point for the application
â”‚   â””â”€â”€ uploads/            # Uploaded files (prescriptions, etc.)
â”œâ”€â”€ Frontend/               # Frontend code
â”‚   â”œâ”€â”€ public/             # Public assets
â”‚   â”‚   â””â”€â”€ PredictiXLogo.png # Logo file
â”‚   â””â”€â”€ src/                # Source code
â”‚       â”œâ”€â”€ assets/         # Static assets
â”‚       â”œâ”€â”€ components/     # React components
â”‚       â”œâ”€â”€ context/        # Context API files
â”‚       â”œâ”€â”€ pages/          # Page components
â”‚       â”œâ”€â”€ ReportTemplate/  # Template for reports
â”‚       â”œâ”€â”€ utils/          # Utility functions
â”‚       â”œâ”€â”€ App.css         # Main CSS file
â”‚       â”œâ”€â”€ App.jsx         # Main React component
â”‚       â””â”€â”€ main.jsx        # Entry point for the frontend
â”œâ”€â”€ Medical Reports/        # Generated medical reports
â”œâ”€â”€ ML/                     # Machine learning models and scripts
â”œâ”€â”€ Screenshots/            # Application screenshots
â”œâ”€â”€ LICENSE                 # License file
â””â”€â”€ README.md               # README file

```


## Future Enhancements

- **OCR Integration:** Plan to replace regex with Optical Character Recognition (OCR) for extracting prescription data more efficiently.
- **Mobile Application:** Expand Predictix into a cross-platform mobile app using React Native.
- **Additional Predictors:** Add more disease predictors to extend the functionality.
- **Enhanced Image Processing:** Use more advanced techniques for image analysis, improving accuracy for cancer detection.
- **Integration with Wearables:** Sync health data from wearables for real-time predictions.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
