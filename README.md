<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/adamtsumagami/nongki">
    <img src="public/assets/favicon-180.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">nongki</h3>

  <p align="center">
    A curated directory and discovery tool for coffee shops and cafes across Pontianak.
    <br />
    <a href="https://github.com/adamtsumagami/nongki"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/adamtsumagami/nongki">View Demo</a>
    ·
    <a href="https://github.com/adamtsumagami/nongki/issues">Report Bug</a>
    ·
    <a href="https://github.com/adamtsumagami/nongki/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#key-features">Key Features</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Pontianak has a well-established coffee culture, ranging from traditional warkop hubs along Jalan Gajah Mada and Jalan Hijas to modern specialty cafes scattered across Reformasi, Podomoro, and Kota Baru. With so many options available, finding the right spot—or simply deciding where to go—often results in decision fatigue.

**Nongki** is an interactive web platform designed to catalogue cafes and coffee shops in Pontianak, helping locals and visitors discover places that match their preferences. Beyond a standard directory, the project introduces practical decision-making tools:

* **Random Cafe Picker**: Eliminates group hesitation by rolling a random cafe based on user criteria.
* **Cafe of the Day**: Highlights a daily curated pick to encourage discovering new spots.
* **Cafe Bucketlist**: Lets users bookmark places they plan to visit and keep track of places they have already checked out.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][TypeScript]][TypeScript-url]
* [![Vite][Vite]][Vite-url]
* [![Lenis][Lenis]][Lenis-url]
* [![Matter.js][Matter.js]][Matter-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- KEY FEATURES -->
## Key Features

* **Pontianak Cafe Catalog**: Search and filter venues by area, atmosphere (e.g., outdoor, quiet work-friendly, aesthetic), amenities (Wi-Fi, power outlets, smoking section), and pricing.
* **Random Cafe Picker**: Quick randomizer with optional constraints (open now, specific subdistrict, or specific facilities) to settle indecision quickly.
* **Cafe of the Day**: Daily featured recommendation showcasing local hidden gems and seasonal spots.
* **Cafe Bucketlist**: Client-side saved wishlist to track visited venues and plan future visits without requiring account setup.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

* **Node.js** (v18.0.0 or higher recommended)
* **npm**
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/adamtsumagami/nongki.git
   cd nongki
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Start the local development server
   ```sh
   npm run dev
   ```
4. Build for production
   ```sh
   npm run build
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

* **Browsing & Filtering**: Use the catalog filter bar to narrow down places by district (e.g., Pontianak Selatan, Pontianak Kota) or requirements (e.g., Wi-Fi, air conditioning, late-night hours).
* **Using Random Picker**: Click the shuffle button on the picker page to get an instant recommendation. Apply quick tags if you only want places suitable for working or places currently open.
* **Managing Bucketlist**: Click the bookmark icon on any cafe card to add it to your personal list. Toggle the status between "Want to visit" and "Visited".

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Base project scaffold and layout setup
- [ ] Pontianak cafe database schema and initial dataset
- [ ] Search and faceted filtering implementation
- [ ] Random Cafe Picker module with filter criteria
- [ ] Cafe of the Day rotation logic
- [ ] Bucketlist persistence using LocalStorage
- [ ] Interactive location mapping (Leaflet / Google Maps integration)
- [ ] Community submission form for new cafe entries

See the [open issues](https://github.com/adamtsumagami/nongki/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Adam Tsumagami - [@adamtsumagami](https://github.com/adamtsumagami)

Project Link: [https://github.com/adamtsumagami/nongki](https://github.com/adamtsumagami/nongki)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [Shields.io](https://shields.io/)
* [Lenis](https://lenis.darkroom.engineering/)
* [Matter.js](https://brm.io/matter-js/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/adamtsumagami/nongki.svg?style=for-the-badge
[contributors-url]: https://github.com/adamtsumagami/nongki/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/adamtsumagami/nongki.svg?style=for-the-badge
[forks-url]: https://github.com/adamtsumagami/nongki/network/members
[stars-shield]: https://img.shields.io/github/stars/adamtsumagami/nongki.svg?style=for-the-badge
[stars-url]: https://github.com/adamtsumagami/nongki/stargazers
[issues-shield]: https://img.shields.io/github/issues/adamtsumagami/nongki.svg?style=for-the-badge
[issues-url]: https://github.com/adamtsumagami/nongki/issues
[license-shield]: https://img.shields.io/github/license/adamtsumagami/nongki.svg?style=for-the-badge
[license-url]: https://github.com/adamtsumagami/nongki/blob/main/LICENSE
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Lenis]: https://img.shields.io/badge/Lenis-000000?style=for-the-badge&logo=fastly&logoColor=white
[Lenis-url]: https://lenis.darkroom.engineering/
[Matter.js]: https://img.shields.io/badge/Matter.js-2C3E50?style=for-the-badge&logo=javascript&logoColor=white
[Matter-url]: https://brm.io/matter-js/
