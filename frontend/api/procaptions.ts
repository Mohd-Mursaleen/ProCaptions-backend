import axios from "axios";
import {
  SegmentationResponse,
  AddDramaticTextRequest,
  AddTextResponse,
  ComposeRequest,
  ComposeResponse,
  MultiLayerTextRequest,
} from "../types/api";

// Create an Axios instance with common configuration
const apiClient = axios.create({
  baseURL: "http://localhost:8000", // Direct URL to FastAPI backend
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 300000, // 5 minutes
});

// Generic error handler for API calls
const handleApiError = (error: any) => {
  console.error("API Error:", error);

  if (error.code === "ECONNABORTED") {
    throw new Error(
      "The request took too long to process. Please try a smaller image or try again later."
    );
  }

  if (error.response) {
    throw new Error(
      error.response.data?.detail || "Server error. Please try again."
    );
  } else if (error.request) {
    throw new Error(
      "No response from server. Please check your connection and try again."
    );
  } else {
    throw new Error("Failed to make request. Please try again.");
  }
};

export const segmentImage = async (
  file: File
): Promise<SegmentationResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    console.log("Sending segmentation request for file:", file.name);
    const response = await apiClient.post<SegmentationResponse>(
      "/api/v1/segment",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    console.log("Segment image response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Segmentation error details:", error);
    return handleApiError(error);
  }
};
// API function to add dramatic text
export const addDramaticText = async (
  request: AddDramaticTextRequest
): Promise<AddTextResponse> => {
  try {
    console.log("Sending dramatic text request:", request);
    const response = await apiClient.post<AddTextResponse>(
      "/api/v1/add-dramatic-text",
      request
    );
    console.log("Add dramatic text response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Add dramatic text error details:", error);
    return handleApiError(error);
  }
};

// API function to compose the final image
export const composeFinalImage = async (
  request: ComposeRequest
): Promise<ComposeResponse> => {
  try {
    const response = await apiClient.post<ComposeResponse>(
      "/api/v1/compose",
      request
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// API function to add multiple text layers
export const addMultipleTextLayers = async (
  request: MultiLayerTextRequest
): Promise<AddTextResponse> => {
  try {
    const response = await apiClient.post<AddTextResponse>(
      "/api/v1/add-multiple-text-layers",
      request
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};
