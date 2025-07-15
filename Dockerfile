# Select OS/Environment
FROM node:22-alpine

# Choose working directory inside docker 
WORKDIR /app

# Copy package.json to install npm packages inside docker 
# copy source destination
COPY package*json ./

# Running shell command
RUN npm install

# Copy rest of the application
COPY . .

# PORT Exposure 
EXPOSE 5050

# Entry Point
CMD [ "node" ,"index.js" ]

