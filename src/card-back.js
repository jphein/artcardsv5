import React from "react";
import "./card-back.css";

const CardBack = ({ width }) => {
  return (
    <div className="card-back" style={width ? { width } : undefined}>
      {/* Outer ornamental border frame */}
      <div className="card-back__border">
        {/* Corner ornaments */}
        <span className="card-back__corner card-back__corner--tl" />
        <span className="card-back__corner card-back__corner--tr" />
        <span className="card-back__corner card-back__corner--bl" />
        <span className="card-back__corner card-back__corner--br" />

        {/* Inner decorative frame */}
        <div className="card-back__inner">
          {/* Central sacred geometry motif */}
          <div className="card-back__motif">
            {/* Diamond shape */}
            <div className="card-back__diamond" />
            {/* Eye / vesica piscis at center */}
            <div className="card-back__eye">
              <div className="card-back__pupil" />
            </div>
            {/* Starburst rays */}
            <div className="card-back__rays" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardBack;
