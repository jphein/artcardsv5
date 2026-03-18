import React from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import "./lightbox.css";

const Lightbox = ({ card, label, sublabel, onClose }) => {
  if (!card) return null;

  const cldImg = new CloudinaryImage(card.public_id, {
    cloudName: card.cloud_name
  });

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        {"\u2715"}
      </button>
      <div className="lightbox-content" onClick={handleContentClick}>
        <AdvancedImage
          cldImg={cldImg}
          alt={card.public_id}
          className="lightbox-image"
        />
        {label && <div className="lightbox-label">{label}</div>}
        {sublabel && <div className="lightbox-sublabel">{sublabel}</div>}
      </div>
    </div>
  );
};

export default Lightbox;
