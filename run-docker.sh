#!/bin/bash

docker run -di --name post-automation -p 3003:3003 -v $(pwd):/usr/src/app \
-v post_automation_node_modules:/usr/src/app/node_modules \
post-automation npm run dev