# Diabetes Risk Screening Tool

A locally hosted Node.js demo application for diabetes risk screening using logistic regression.

## Features

- Form-based UI collecting age, BMI, hypertension status, physical activity, and sleep hours
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

| Field            | Type             | Description                        |
|------------------|------------------|------------------------------------|
| `age`            | number           | Age in years                       |
| `bmi`            | number           | Body Mass Index (kg/m²)            |
| `hypertension`   | boolean / string | `true` or `"true"` if yes          |
| `physicalActivity` | boolean / string | `true` or `"true"` if active     |
| `sleepHours`     | number           | Average sleep hours per night      |

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
  "hypertension": 0.8,
  "physicalActivity": -0.6,
  "sleepHours": -0.1
}
```

Restart the server after making changes.