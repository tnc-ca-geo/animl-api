import random
import requests
import time
import json

def get_random_labels():
    labels = [
        "empty",
        "unknown",
        "1",
        "bird",
        "2",
        "rodent"]
    num_to_select = random.randint(1,len(labels)-1)
    labelIds = random.sample(labels, num_to_select)
    return labelIds

def get_images():
    url = "http://localhost:3000/dev/external"
    labels = get_random_labels()
    payload = json.dumps({
        "query": "\n      \n      query GetImages($input: QueryImagesInput!) {\n        images(input: $input) {\n          images {\n            \n  _id\n  dateTimeOriginal\n  timezone\n  dateAdded\n  cameraId\n  make\n  originalFileName\n  fileTypeExtension\n  deploymentId\n  projectId\n  awaitingPrediction \nobjects {\n    \n  _id\n  bbox\n  locked\n  labels {\n    \n  _id\n  type\n  conf\n  bbox\n  labeledDate\n  labelId\n  validation {\n    validated\n    validationDate\n    userId\n  }\n  mlModel\n  userId\n\n  }\n\n  }\n  comments {\n    \n  _id\n  author\n  created\n  comment\n\n  }\n  reviewed\n\n          }\n          pageInfo {\n            \n  previous\n  hasPrevious\n  next\n  hasNext\n\n          }\n        }\n      }\n    \n    ",
        "variables": {
            "input": {
                "paginatedField": "dateTimeAdjusted",
                "sortAscending": False,
                "limit": 50,
                "filters": {
                    "cameras": None,
                    "deployments": None,
                    "labels": labels,
                    "createdStart": None,
                    "createdEnd": None,
                    "addedStart": None,
                    "addedEnd": None,
                    "reviewed": None,
                    "custom": None
                }
            }
        },
        "operationName": "GetImages"
    })
    headers = {
        'x-selected-project': 'henrysproject',
        'Content-Type': 'application/json',
        'Authorization': 'bearer '
    }

    return requests.request("POST", url, headers=headers, data=payload)


def main():
    num_requests = 1000

    total_time = 0
    for i in range(num_requests):
        start_time = time.perf_counter()
        res = get_images()
        end_time = time.perf_counter()
        print(f"Request {i+1} took {end_time - start_time:.4f} seconds and returned status code {res.status_code}")
        total_time += (end_time - start_time)
    print(f"Average time per request: {total_time / num_requests:.4f} seconds")


if __name__ == "__main__":
    main()
