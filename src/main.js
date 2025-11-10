import "./style.css";
import { dates } from "./utils/dates";

// Import google genai sdk
import { GoogleGenAI } from "@google/genai";

const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const tickersArr = [];

const generateReportBtn = document.querySelector(".generate-report-btn");

generateReportBtn.addEventListener("click", fetchStockData);

document.getElementById("ticker-input-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const tickerInput = document.getElementById("ticker-input");
  if (tickerInput.value.length > 2) {
    generateReportBtn.disabled = false;
    const newTickerStr = tickerInput.value;
    tickersArr.push(newTickerStr.toUpperCase());
    tickerInput.value = "";
    renderTickers();
  } else {
    const label = document.getElementsByTagName("label")[0];
    label.style.color = "red";
    label.textContent =
      "You must add at least one ticker. A ticker is a 3 letter or more code for a stock. E.g TSLA for Tesla.";
  }
});

function renderTickers() {
  const tickersDiv = document.querySelector(".ticker-choice-display");
  tickersDiv.innerHTML = "";
  tickersArr.forEach((ticker) => {
    const newTickerSpan = document.createElement("span");
    newTickerSpan.textContent = ticker;
    newTickerSpan.classList.add("ticker");
    tickersDiv.appendChild(newTickerSpan);
  });
}

const loadingArea = document.querySelector(".loading-panel");
const apiMessage = document.getElementById("api-message");

async function fetchStockData() {
  if (tickersArr.length === 0) {
    loadingArea.innerText = "Add at least one ticker.";
    return;
  }

  document.querySelector(".action-panel").style.display = "none";
  loadingArea.style.display = "flex";

  try {
    const stockData = await Promise.all(
      tickersArr.map(async (ticker) => {
        const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${dates.startDate}/${dates.endDate}?apiKey=${POLYGON_API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Polygon ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return { ticker, data };
      })
    );

    apiMessage.innerText = "Creating report...";
    fetchReport(stockData);
  } catch (err) {
    loadingArea.innerText = "There was an error fetching stock data.";
    console.error("fetchStockData error:", err);
  }
}

async function fetchReport(stockData) {
  const promptMessage = `
        You are a trading guru. Given data on share prices over the past 3 days, write a report of no more than 150 words describing the stocks performance and recommend whether to buy, hold or sell the provided stockData.
         
        Format exactly like and put an <hr> after each stock report except the last one:

        <p><strong class="bold">Stock:</strong>...</p> <p><strong class="bold">Summary:</strong> ...</p> <p><strong class="bold">Recommendation:</strong> ...</p>

        stockData: ${JSON.stringify(stockData, null, 2)}
      `;

  try {
    if (!GEMINI_API_KEY) {
      loadingArea.innerText =
        "Unable to access AI. Please refresh and try again.";
      console.error("Error: ", err);
      return;
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: promptMessage,
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.2,
        frequencyPenalty: 0.5,
        presencePenalty: 0.0,
      },
    });

    const htmlOutput = response.text;
    renderReport(htmlOutput);
  } catch (err) {}
}

function renderReport(htmlOutput) {
  loadingArea.style.display = "none";
  const outputArea = document.querySelector(".output-panel");
  outputArea.innerHTML = htmlOutput;
  outputArea.style.display = "block";
}
