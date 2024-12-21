# Use the official Node.js image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files into the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application into the container
COPY . .

# Build the TypeScript files
RUN npx tsc

# Expose the port your app will run on (e.g., 8080)
EXPOSE 8080

# Command to run the application
CMD ["node", "dist/index.js"]
