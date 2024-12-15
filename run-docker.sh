#!/bin/bash

docker run -di --name appwrite-node-starter -p 3003:3003 -v $(pwd):/usr/src/app \
-v appwrite_node_starter_node_modules:/usr/src/app/node_modules \
e-rate-scout-send-notifications npm run dev