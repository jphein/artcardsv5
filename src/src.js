import { useState, useEffect } from "react";

const RandomImageWithSrc = ({ imageTag }) => {
  const [src, setSrc] = useState();

  useEffect(() => {
    const srcRegex = /src="([^"]*)"/;
    const extractedSrc = imageTag.match(srcRegex)[1];
    setSrc(extractedSrc);
  }, [imageTag]);

  return src;
};

export default RandomImageWithSrc;
