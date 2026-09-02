import React, {JSX} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import 'react-medium-image-zoom/dist/styles.css';
import {useColorMode} from "@docusaurus/theme-common";

type SponsorItem = {
  sponsor: string;
  logo: string;
  logoDM: string;
  url: string;
  desc: string;
};

const SponsorList: SponsorItem[] = [
  /* {
    sponsor: 'Name of Sponsor',
    logo: '/img/homepage/sponsor/image.png',
    url: 'https://example.com',
    desc: '',
  }, */
    {
  sponsor: 'DataForest',
  logo: '/img/homepage/sponsor/df-cloud-logo.svg',
  logoDM: '/img/homepage/sponsor/df-cloud-logo-darkmode.svg',
  url: 'https://cloud.dataforest.net/?mtm_campaign=pelican&mtm_kwd=main',
  desc: '',
},
    {
  sponsor: 'DreamHost',
  logo: '/img/homepage/sponsor/dreamhost-logo.png',
  logoDM: '/img/homepage/sponsor/dreamhost-logo-darkmode.png',
  url: 'https://www.dreamhost.com/hosting/vps/pelican/',
  desc: '',
},
];

function Sponsor({sponsor, logo, logoDM, url, desc}: SponsorItem) {

    const {colorMode} = useColorMode();
    let image: string;

    if (colorMode === 'dark') {
        image = logoDM;
    } else {
        image = logo;
    }

  return (
      <a href={url} title={sponsor} style={{flex: '1 1 300px', textAlign: 'center'}}>
        <img src={image} alt={sponsor} style={{height: '130px', width: 'auto', maxWidth: '100%', objectFit: 'contain'}}/>
      </a>
    );
  }

export default function HomepageSponsor(): JSX.Element {
  return (
    <section className={styles.features} style={{borderTop: '1px solid var(--ifm-color-emphasis-200)'}}>
      <div className="container">
      <h1 style={{textAlign: 'center'}}>Project Sponsors</h1>
        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '3rem 0', padding: '2rem 0 1rem'}}>
          {SponsorList.map((props, idx) => (
            <Sponsor key={idx} {...props} />
          ))}
        </div>
        <p style={{textAlign: 'center', margin: '1rem auto 0',fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--ifm-color-emphasis-600)'}}>
          A heartfelt thank you to our sponsors, whose generous support keeps Pelican flying.
        </p>
      </div>
    </section>
  );
}

