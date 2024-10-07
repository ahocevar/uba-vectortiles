import { GeoPackageManager } from '@ngageoint/geopackage';
import { promisify } from 'util';
import {finished as streamFinished} from 'stream';
import fs from 'fs';
import path from 'path';
import { Unzip, AsyncUnzipInflate } from 'fflate';
import { once } from 'events';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const geoJSONOutDir = path.join(__dirname, '..', 'data');
const archive = path.join(__dirname, '..', 'data', 'FI_2022_AT.zip');
const geopackageFileName = 'FI_2022_AT.gpkg'
const geoPackageFile = path.join(__dirname, '..', 'data', geopackageFileName);

function toPrecision(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

const finished = promisify(streamFinished);

(async () => {

await new Promise((resolve, reject) => {
  let done = false;
  const unzip = new Unzip((file) => {
    if (file.name === geopackageFileName) {
      const writeStream = fs.createWriteStream(geoPackageFile);
      file.ondata = (err, chunk, final) => {
        if (err) {
          reject(err);
          return;
        }
        writeStream.write(chunk);
        if (final) {
          writeStream.end();
          if (done) {
            resolve();
          }
        }
      };
      file.start();
    }
  });
  unzip.register(AsyncUnzipInflate);

  const inStream = fs.createReadStream(archive);
  inStream.on('data', (chunk) => unzip.push(chunk));
  inStream.on('end', () => {
    done = true;
    unzip.push(new Uint8Array(), true);
  });
});

const gp = await GeoPackageManager.open(geoPackageFile);

const crsDefinition = gp.getSpatialReferenceSystemDao();
const srsId = '31287';
const crs = crsDefinition.getBySrsId(srsId);
crs.setDefinition(`PROJCS["MGI / Austria Lambert",
    GEOGCS["MGI",
        DATUM["Militar-Geographische_Institut",
            SPHEROID["Bessel 1841",6377397.155,299.1528128],
            TOWGS84[577.326,90.129,463.919,5.137,1.474,5.297,2.4232]],
        PRIMEM["Greenwich",0,
            AUTHORITY["EPSG","8901"]],
        UNIT["degree",0.0174532925199433,
            AUTHORITY["EPSG","9122"]],
        AUTHORITY["EPSG","4312"]],
    PROJECTION["Lambert_Conformal_Conic_2SP"],
    PARAMETER["latitude_of_origin",47.5],
    PARAMETER["central_meridian",13.3333333333333],
    PARAMETER["standard_parallel_1",49],
    PARAMETER["standard_parallel_2",46],
    PARAMETER["false_easting",400000],
    PARAMETER["false_northing",400000],
    UNIT["metre",1,
        AUTHORITY["EPSG","9001"]],
    AUTHORITY["EPSG","31287"]]`);
crsDefinition.update({
  srs_name: crs.srs_name,
  srs_id: crs.srs_id,
  organization: crs.organization,
  organization_coordsys_id: crs.organization_coordsys_id,
  definition: crs.definition,
  description: crs.description
});

await Promise.all(gp.getFeatureTables().map(table => ((async () => {
  console.log('Table:', table);
  const iterator = gp.queryForGeoJSONFeatures(table);
  const writeStream = fs.createWriteStream(path.join(geoJSONOutDir, `${table}.geojson`), {encoding: 'utf8'});
  writeStream.write('{"type":"FeatureCollection","features":[');
  try {
    let prefix = '';
    for await (const feature of iterator) {
      const properties = feature.properties;
      if (feature.geometry === null || properties['FLAECHE'] < 1) {
        continue;
      }
      delete properties['OBJECTID'];
      delete properties['KG_NR'];
      delete properties['GKZ'];
      delete properties['BKZ'];
      delete properties['BL_KZ'];
      const coordinates = feature.geometry.coordinates;
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates = coordinates.map(polygon => polygon.map(ring => ring.map(([x, y]) => [toPrecision(x, 7), toPrecision(y, 7)])));
      } else if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates = coordinates.map(ring => ring.map(([x, y]) => [toPrecision(x, 7), toPrecision(y, 7)]));
      }
      if (!writeStream.write(prefix + JSON.stringify(feature))) {
        await once(writeStream, 'drain');
      }
      prefix = '\n,';
    }
  } catch (err) {
    //
  } finally {
    iterator.close();
    writeStream.end(']}');
    await finished(writeStream);
  }
}))()));

})();