import React, { useState } from "react";
import "../App.css";
import Modal from "react-modal";
import { Trans, useI18n } from "../i18n/I18nContext";

import image from "../assets/AboutImg/image.avif";

// Define team members
const teamMembers = [
  {
    imgUrl: image,
    name: "Anubhav Jha 23BAI11112",
    position: "VIT Bhopal",
  },
  {
    imgUrl: image,
    name: "Sanjot Mirashe 23BAI10932",
    position: "VIT Bhopal",
  },
  {
    imgUrl: image,
    name: "Divya Shukla 23BAI11320",
    position: "VIT Bhopal",
  },
  {
    imgUrl: image,
    name: "Sanskriti Singh 23BAI10269",
    position: "VIT Bhopal",
  },
  {
    imgUrl: image,
    name: "Thilak Raaj 23BAI10724",
    position: "VIT Bhopal",
  },
  {
    imgUrl: image,
    name: "Shubham Sura 23BAI11141",
    position: "VIT Bhopal",
  },
];

// Custom modal styles
const customStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    maxWidth: "90%",
    maxHeight: "90%",
    overflow: "hidden",
    padding: 0,
    border: "none",
    borderRadius: "10px",
    transition: "opacity 0.5s ease, transform 0.5s ease",
    opacity: 0,
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    transition: "opacity 0.5s ease",
  },
};

Modal.setAppElement("#root");

function AboutPage() {
  const { t } = useI18n();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setModalIsOpen(true);
    setTimeout(() => {
      document.querySelector(".ReactModal__Content").style.opacity = 1;
      document.querySelector(".ReactModal__Content").style.transform =
        "translate(-50%, -50%) scale(1)";
    }, 1);
  };

  const closeModal = () => {
    document.querySelector(".ReactModal__Content").style.opacity = 0;
    document.querySelector(".ReactModal__Content").style.transform =
      "translate(-50%, -50%) scale(0.8)";
    setTimeout(() => {
      setModalIsOpen(false);
      setSelectedImage("");
    }, 500);
  };

  return (
    <section className="our__team">
      <div className="container">
        <div className="team__content">
          <h6 className="subtitle">{t("aboutUs.welcome")}</h6>
          <h2>
            <Trans
              k="aboutUs.meetOur"
              components={{ highlight: <span className="highlight" /> }}
            />
          </h2>
        </div>
        <div className="team__wrapper">
          {teamMembers.map((item, index) => (
            <div className="team__item" key={index}>
              <div className="team__img">
                <img
                  src={item.imgUrl}
                  alt={item.name}
                  onClick={() => openModal(item.imgUrl)}
                  style={{ cursor: "pointer" }}
                />
              </div>
              <div className="team__details">
                <h4>{item.name}</h4>
                <p className="description">{item.position}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="Enlarged Image"
      >
        <img src={selectedImage} alt="Enlarged view" className="modal-image" />
      </Modal>
    </section>
  );
}

export default AboutPage;
