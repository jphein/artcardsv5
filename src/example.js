import React, { Component, useEffect } from "react";
import Carousel from "react-spring-3d-carousel";
import uuidv4 from "uuid";
import { config } from "react-spring";
import RandomImage from "./random";
import { useHints } from "./hints";
import "./nav.css";

// Functional helper: fires carousel-nav hint on first mount
function CarouselHints() {
  const { showHint, HintOverlay } = useHints();
  useEffect(() => {
    showHint("carousel-nav", {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }, [showHint]);
  return <HintOverlay />;
}

const CLOUD_NAME = "dqm00mcjs";
const TAG = "carousel";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const getTouches = (evt) => {
  return evt.touches || evt.originalEvent.touches;
};

export default class Example extends Component {
  state = {
    goToSlide: 1,
    offsetRadius: 4,
    showNavigation: false,
    enableSwipe: true,
    config: config.slow,
    images: null,
    flash: false
  };

  componentDidMount() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("wheel", this.handleWheel, { passive: false });
    this.fetchImages();
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("wheel", this.handleWheel);
  }

  fetchImages = async () => {
    const response = await fetch(
      `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`
    );
    const data = await response.json();
    const shuffled = shuffle(data.resources);
    this.setState({ images: shuffled });
  };

  getSlides() {
    if (!this.state.images) return [];
    return this.state.images.map((img, index) => ({
      key: img.public_id,
      content: (
        <RandomImage
          cloud_name={CLOUD_NAME}
          public_id={img.public_id}
          slideIndex={index}
        />
      ),
      onClick: () => this.setState({ goToSlide: index })
    }));
  }

  handleTouchStart = (evt) => {
    if (!this.state.enableSwipe) return;
    const firstTouch = getTouches(evt)[0];
    this.setState({
      xDown: firstTouch.clientX,
      yDown: firstTouch.clientY
    });
  };

  handleTouchMove = (evt) => {
    if (!this.state.enableSwipe || (!this.state.xDown && !this.state.yDown)) {
      return;
    }
    let xUp = evt.touches[0].clientX;
    let yUp = evt.touches[0].clientY;
    let xDiff = this.state.xDown - xUp;
    let yDiff = this.state.yDown - yUp;
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
      if (xDiff > 0) {
        this.setState({ goToSlide: this.state.goToSlide + 1, xDown: null, yDown: null });
      } else {
        this.setState({ goToSlide: this.state.goToSlide - 1, xDown: null, yDown: null });
      }
    }
  };

  handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      this.setState({ goToSlide: this.state.goToSlide + 1 });
    } else if (e.deltaY < 0) {
      this.setState({ goToSlide: this.state.goToSlide - 1 });
    }
  };

  handleKeyDown = (e) => {
    switch (e.keyCode) {
      case 37:
        this.setState({ goToSlide: this.state.goToSlide - 1 });
        break;
      case 39:
        this.setState({ goToSlide: this.state.goToSlide + 1 });
        break;
      default:
        break;
    }
  };

  moveLeft = () => {
    this.setState({ goToSlide: this.state.goToSlide - 1 });
  };

  moveRight = () => {
    this.setState({ goToSlide: this.state.goToSlide + 1 });
  };

  render() {
    const slides = this.getSlides();
    if (slides.length === 0) return null;

    return (
      <div
        className="carousel-wrapper"
        onTouchStart={this.handleTouchStart}
        onTouchMove={this.handleTouchMove}
      >
        <div className={`carousel-flash ${this.state.flash ? "carousel-flash--active" : ""}`} />
        <CarouselHints />
        <Carousel
          slides={slides}
          goToSlide={this.state.goToSlide}
          offsetRadius={this.state.offsetRadius}
          showNavigation={this.state.showNavigation}
          animationConfig={this.state.config}
        />
        <button className="nav-btn nav-btn--left" onClick={this.moveLeft}>
          <span className="nav-btn__corner nav-btn__corner--tl" />
          <span className="nav-btn__corner nav-btn__corner--tr" />
          <span className="nav-btn__corner nav-btn__corner--bl" />
          <span className="nav-btn__corner nav-btn__corner--br" />
          <span className="nav-btn__icon">{"\u276E"}</span>
        </button>
        <button className="nav-btn nav-btn--right" onClick={this.moveRight}>
          <span className="nav-btn__corner nav-btn__corner--tl" />
          <span className="nav-btn__corner nav-btn__corner--tr" />
          <span className="nav-btn__corner nav-btn__corner--bl" />
          <span className="nav-btn__corner nav-btn__corner--br" />
          <span className="nav-btn__icon">{"\u276F"}</span>
        </button>
        {this.props.onSwitchToTable && (
          <button className="nav-btn nav-btn--table" onClick={this.props.onSwitchToTable} title="Back to Table">
            <span className="nav-btn__icon">{"\u2726"}</span>
            <span className="nav-btn--table-label">Table</span>
          </button>
        )}
      </div>
    );
  }
}
