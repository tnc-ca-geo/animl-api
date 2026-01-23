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
        'Authorization': 'bearer eyJraWQiOiI4Q1d0UXZWSXFSU0VxbEM4M0FDOEI3NVk3cm1Ta0lxVDhqdExHbHJETU5VPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIxYTdiNzJhNS0wZjk5LTRlNGEtYmQ2Ny1hYjg5NTBkNjhhNGQiLCJhdWQiOiI0MG1jcDVvZGo1YWVrNnI5MWc2cXVvczNlciIsImNvZ25pdG86Z3JvdXBzIjpbImFuaW1sXC9qbGRwXC9wcm9qZWN0X21hbmFnZXIiLCJhbmltbFwvZGVmYXVsdF9wcm9qZWN0XC9wcm9qZWN0X21hbmFnZXIiLCJhbmltbFwvaGVucnlzcHJvamVjdFwvcHJvamVjdF9tYW5hZ2VyIiwiYW5pbWxcL3NjaV9iaW9zZWN1cml0eVwvcHJvamVjdF9tYW5hZ2VyIiwiYW5pbWxfc3VwZXJ1c2VyIiwiYW5pbWxcL2lzbGFuZF9zcG90dGVkX3NrdW5rc1wvcHJvamVjdF9tYW5hZ2VyIl0sImV2ZW50X2lkIjoiMTg4NDdiNzgtMTllYy00MmI3LThjYjktYmQ5Mjk2NzMzNTc2IiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE3NjkxMDQ4MTIsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy13ZXN0LTIuYW1hem9uYXdzLmNvbVwvdXMtd2VzdC0yXzlKaXhVcGtZVCIsImNvZ25pdG86dXNlcm5hbWUiOiJoZW5yeS5qdWVAdG5jLm9yZyIsImV4cCI6MTc2OTEyMDc5NCwiaWF0IjoxNzY5MTE3MTk0LCJlbWFpbCI6ImhlbnJ5Lmp1ZUB0bmMub3JnIn0.YL6-Tfee3uxz1I3CBx4E-ZGnkTlPtvATl0JwCQUvt-5IP1Pn59bmodecPyNBOmrnDvpJ2cQ1xg7YMTFXx_JxyjzCkSswRKuKTAzQjnC032VFt9d98R1c9xBAqWYX6sISbG7nDhbISEejYL4DDjsX6snyEP157wVO-7yWjIKMFbZbWdr_IeF6w1pcdzPTaO0ertWcavn0bVU3BSPIAk5K12bQPj_P1zoY_P56iiiuAxuVcHSt2rdbuWz6wx4XCGDjGxLC_8mE6SD5Xf8sBzkUsgyeCQLyicmdLoQ8_vG13lWm4rEnLVjiHzBTXS13ZPU_DKJz-ctIEt5ZkrPOhV3l1w'
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
