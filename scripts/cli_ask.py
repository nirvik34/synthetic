import requests
import sys
import json

def ask_question(question: str):
    url = "http://127.0.0.1:8000/ask"
    payload = {
        "question": question,
        "top_k": 5
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            result = response.json()
            print(f"\nQ: {result['question']}")
            print(f"Confidence: {result['confidence'].upper()}")
            print("-" * 20)
            print(f"A: {result['answer']}")
            print("-" * 20)
            if result['sources']:
                print("Sources:")
                for src in result['sources']:
                    print(f"- {src['document']} (Score: {src['score']:.2f})")
            else:
                print("No specific sources cited.")
        else:
            print(f"Error {response.status_code}: {response.text}")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Is it running on http://127.0.0.1:8000?")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = input("Enter your question: ")
    
    ask_question(question)
