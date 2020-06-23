# Hydroponic Pi

#### Project that aims to automate a hydroponic system.

The watering of the plants is being controlled. The Ph, electrical conductivity, and temperature of the water are being monitored, as well as the humidity and temperature of the environment.

## Arduino Code

-   Install [platformio](https://platformio.org/) and make sure it's added to your path
-   Run `pio lib install` to install the dependencies
-   Build the code with `pio run`
-   Build and Upload it with `pio run -t upload`

## Raspberry Pi Code

-   Install [nodejs](https://nodejs.org/en/)
-   Run `npm install` to install the dependencies
-   `npm start` runs the code

To execute the code on boot, copy the unit file to the systemd folder and give it permissions:  
`sudo cp hydroponicpi.service /etc/systemd/system/hydroponicpi.service`  
`sudo chmod 644 /etc/systemd/system/hydroponicpi.service`  
Then ensure that the service starts when the system boots:  
`sudo systemctl enable hydroponicpi`
