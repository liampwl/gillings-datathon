# Diabetes Risk Screening Tool

A locally hosted Node.js demo application for diabetes risk screening using logistic regression.

## Features

- Form-based UI collecting demographics, lifestyle factors, healthcare access, and medical history.
- `/predict` REST API endpoint powered by a configurable logistic regression model
- Risk classification: **Low**, **Moderate**, or **High**
- Coefficients stored in `model/coefficients.json` — easy to update without touching server code

## Project Structure

```
.
├── model/
│   └── coefficients.json   # Logistic regression coefficients
├── public/
│   ├── index.html          # Frontend form
│   ├── style.css           # Styling
│   └── app.js              # Frontend JavaScript
├── server/
│   └── index.js            # Express server & /predict endpoint
├── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) v14 or later

## Running Locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm start
   ```

3. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## API Reference

### `POST /predict`

**Request body (JSON):**

| Field | Type | Description |
|------------------|------------------|------------------------------------|
| `age` | number | Age in years |
| `bmi` | number | Body Mass Index (kg/m²) |
| `sleepHours` | number | Average sleep hours per night |
| `zipCode` | string | 5-digit ZIP code (Optional) |
| `HighBP` | boolean / string | High Blood Pressure (`true`/`false`) |
| `HighChol` | boolean / string | High Cholesterol (`true`/`false`) |
| `CholCheck` | boolean / string | Cholesterol Check in last 5 yrs (`true`/`false`) |
| `Smoker` | boolean / string | Smoker (≥100 cigs in life) (`true`/`false`) |
| `Stroke` | boolean / string | Ever had a stroke (`true`/`false`) |
| `HeartDiseaseorAttack` | boolean / string | Heart Disease / Attack (`true`/`false`) |
| `PhysActivity` | boolean / string | Physically Active past 30 days (`true`/`false`) |
| `Fruits` | boolean / string | Consume Fruits ≥1/day (`true`/`false`) |
| `Veggies` | boolean / string | Consume Veggies ≥1/day (`true`/`false`) |
| `HvyAlcoholConsump` | boolean / string | Heavy Drinker (`true`/`false`) |
| `AnyHealthcare` | boolean / string | Healthcare Coverage (`true`/`false`) |

**Response (JSON):**

```json
{
  "probability": 0.3821,
  "riskCategory": "Moderate"
}
```

`riskCategory` is one of:
- `"Low"` — probability < 30%
- `"Moderate"` — probability 30–59%
- `"High"` — probability ≥ 60%

## Configuring the Model

Edit `model/coefficients.json` to adjust the logistic regression coefficients:

```json
{
  "intercept": -5.5,
  "age": 0.04,
  "bmi": 0.09,
  "sleepHours": -0.1,
  "HighBP": 0.8,
  "HighChol": 0.5,
  "CholCheck": -0.2,
  "Smoker": 0.4,
  "Stroke": 0.5,
  "HeartDiseaseorAttack": 0.6,
  "PhysActivity": -0.6,
  "Fruits": -0.1,
  "Veggies": -0.1,
  "HvyAlcoholConsump": 0.2,
  "AnyHealthcare": -0.3
}
```

Coefficients are loaded dynamically on every request, so you **do not** need to restart the server after making changes to `coefficients.json`.