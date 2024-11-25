FROM mcr.microsoft.com/powershell:7.4-mariner-2.0-arm64

ENV APP_ROOT_DIR="/app"

RUN pwsh -Command Set-PSRepository -Name PSGallery -InstallationPolicy Trusted && \
    pwsh -Command Install-Module -Name ExchangeOnlineManagement -Scope AllUsers -RequiredVersion 3.5.0 && \
    pwsh -Command Set-PSRepository -Name PSGallery -InstallationPolicy Untrusted 

RUN yum install -y nodejs npm

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Command to run tests
CMD ["npm", "run", "test-docker"]