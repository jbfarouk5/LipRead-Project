# 🗣️ LipRead — Visual Speech Recognition

A deep learning project for recognizing **spoken words from video by analyzing lip movements**, without relying on audio.

The project focuses on **Visual Speech Recognition (VSR)** and explores different deep learning architectures combining **CNN-based visual feature extraction** with recurrent neural networks such as **GRU, LSTM, and BiGRU**.

---

## 🎯 Project Objective

The main objective of this project is to develop a system capable of recognizing a predefined set of spoken words using only the visual information contained in a video.

Instead of analyzing the speaker's voice, the system analyzes the movement of the lips and learns the visual patterns associated with each word.

The current project focuses on **13 isolated words**, with each video containing one spoken word.

---

## 🔍 Project Pipeline

The complete pipeline consists of several stages:

```text
Input Video
     │
     ▼
Audio / Speech Segmentation
     │
     ▼
Individual Word Clips
     │
     ▼
Face & Mouth Detection
     │
     ▼
Mouth ROI Extraction
     │
     ▼
Preprocessing & Augmentation
     │
     ▼
CNN Feature Extraction
     │
     ▼
Temporal Modeling
     │
     ├── GRU
     ├── LSTM
     └── BiGRU
     │
     ▼
Word Classification
     │
     ▼
Predicted Word
```

---

## 🧩 Main Components

### 1. Video Segmentation

The original videos are processed to separate individual spoken words.

The segmentation pipeline uses speech activity detection and additional refinement techniques to identify speech regions and produce individual clips.

The target dataset contains **13 word classes**.

Each resulting clip should contain a single spoken word.

---

### 2. Mouth Region Extraction

After segmentation, the system detects the speaker's face and extracts the region around the mouth.

This reduces irrelevant visual information and allows the neural network to focus primarily on lip movements.

The extracted mouth regions are resized to:

```text
96 × 96 pixels
```

---

### 3. Data Preprocessing

The extracted video sequences are prepared for model training through preprocessing and augmentation.

The preprocessing stage includes operations such as:

* Frame extraction
* Mouth ROI cropping
* Image resizing
* Normalization
* Sequence preparation
* Data augmentation

Data augmentation is used to increase the variability of the training data and improve model robustness.

---

## 🧠 Model Architecture

Several architectures are investigated in the project.

### CNN + GRU

A CNN is used to extract spatial features from individual mouth frames.

The resulting feature sequence is then processed by a GRU network to model the temporal evolution of the lip movements.

```text
Mouth Frames
     ↓
MobileNetV2
     ↓
Visual Features
     ↓
GRU
     ↓
Dense Layer
     ↓
13 Word Classes
```

### CNN + LSTM

The CNN extracts visual features while an LSTM processes the temporal sequence.

```text
Mouth Frames
     ↓
MobileNetV2
     ↓
Visual Features
     ↓
LSTM
     ↓
Dense Layer
     ↓
13 Word Classes
```

### CNN + BiGRU

A bidirectional GRU is also investigated to process temporal information in both directions.

```text
Mouth Frames
     ↓
MobileNetV2
     ↓
Visual Features
     ↓
BiGRU
     ↓
Dense Layer
     ↓
13 Word Classes
```

---

## 🏗️ CNN Backbone

The project uses **MobileNetV2** as the CNN backbone for visual feature extraction.

The backbone is used to transform individual mouth images into compact visual representations before they are passed to the temporal model.

The experiments investigate different recurrent archit
