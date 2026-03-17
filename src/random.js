import React from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";

const RandomImage = ({ cloud_name, public_id, slideIndex }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ public_id, cloud_name, slideIndex })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const myImage = new CloudinaryImage(public_id, {
    cloudName: cloud_name
  });

  return (
    <span
      draggable
      onDragStart={handleDragStart}
      style={{ cursor: "grab", display: "contents" }}
    >
      <AdvancedImage cldImg={myImage} alt={public_id} />
    </span>
  );
};

export default RandomImage;
