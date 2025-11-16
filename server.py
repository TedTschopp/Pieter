from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import json

app = Flask(__name__)
CORS(app)

@app.route("/local")
def local_knowledge():
    with open("knowledge.json", "r") as f:
        data = json.load(f)
    return jsonify(data)

@app.route("/search")
def search():
    query = request.args.get("q")
    if not query:
        return jsonify({"error": "No query"}), 400

    url = "https://duckduckgo.com/html/"
    params = {"q": query}

    r = requests.get(url, params=params, headers={
        "User-Agent": "Mozilla/5.0"
    })

    soup = BeautifulSoup(r.text, "html.parser")

    results = []
    for result in soup.select(".result__body")[:5]:
        title = result.select_one(".result__title").text.strip()
        snippet = result.select_one(".result__snippet").text.strip()
        link = result.select_one(".result__a")["href"]
        results.append({
            "title": title,
            "snippet": snippet,
            "link": link
        })

    return jsonify({"query": query, "results": results})

if __name__ == "__main__":
    app.run(port=5000)
