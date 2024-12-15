# Use the official Node.js image
FROM node:20

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

EXPOSE 3003

# Command to run the application
CMD ["npm", "run", "dev"]