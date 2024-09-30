# Flächeninanspruchnahme

## Install dependencies

[Node](https://nodejs.org/) version 14 or higher (recommended: 20 or higher) is required.

For dependencies that can automatically be installed, run

    npm install

[Tippecanoe](https://github.com/felt/tippecanoe/) has to be installed manually. The data scripts expect a `tippecanoe` binary in the path.

## Prepare data:

Download `FI_2022_AT.zip` from https://docs.umweltbundesamt.at/s/cpXEnFQAEzT7LXp?path=%2F%C3%96ROK-Monitoring%202022%20-%20%C3%96sterreich%20gesamt#.

Copy the downloaded file into the `data/` folder.

Run

       npm run data

## Run the development server

To get started, run the following:

    npm start

To generate a build ready for production:

    npm run build

Then deploy the contents of the `dist` directory to your server.  You can also run `npm run serve` to serve the results of the `dist` directory for preview.
