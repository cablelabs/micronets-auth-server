FROM node:8

# Development packages
RUN apt-get update; apt-get --assume-yes install vim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json .
COPY package.json package-lock.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 3020
CMD [ "npm", "start" ]