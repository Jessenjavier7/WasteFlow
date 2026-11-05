"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet marker icon
const markerIcon = L.icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (latitude: number, longitude: number) => void;
  onAddressChange: (address: string) => void;
};

const DEFAULT_POSITION: [number, number] = [-6.2088, 106.8456];

type MapClickHandlerProps = {
  onLocationChange: (latitude: number, longitude: number) => void;
};

function MapClickHandler({ onLocationChange }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onLocationChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();

    const isSamePosition =
      Math.abs(currentCenter.lat - position[0]) < 0.000001 &&
      Math.abs(currentCenter.lng - position[1]) < 0.000001;

    if (!isSamePosition) {
      map.flyTo(position, 16, {
        duration: 0.8,
      });
    }
  }, [map, position]);

  return null;
}

type LocationMapProps = {
  position: [number, number];
  hasSelectedLocation: boolean;
  onLocationChange: (latitude: number, longitude: number) => void;
};

function LocationMap({
  position,
  hasSelectedLocation,
  onLocationChange,
}: LocationMapProps) {
  return (
    <MapContainer
      center={position}
      zoom={hasSelectedLocation ? 16 : 11}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onLocationChange={onLocationChange} />

      <MapUpdater position={position} />

      {hasSelectedLocation && <Marker position={position} icon={markerIcon} />}
    </MapContainer>
  );
}

export default function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
  onAddressChange,
}: LocationPickerProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  const hasSelectedLocation = latitude !== null && longitude !== null;

  // Keep the position reference stable between renders.
  const position = useMemo<[number, number]>(() => {
    return hasSelectedLocation ? [latitude!, longitude!] : DEFAULT_POSITION;
  }, [hasSelectedLocation, latitude, longitude]);

  // Reverse Geocoding
  useEffect(() => {
    if (latitude === null || longitude === null) {
      setIsLoadingAddress(false);
      setAddressError("");
      return;
    }

    const controller = new AbortController();

    setIsLoadingAddress(true);
    setAddressError("");

    const timeoutId = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: latitude.toString(),
          lon: longitude.toString(),
          "accept-language": "id",
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to retrieve address.");
        }

        const result = await response.json();

        if (!result.display_name) {
          throw new Error("Address not found for this location.");
        }

        onAddressChange(result.display_name);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("REVERSE GEOCODING ERROR:", error);

        setAddressError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve address.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAddress(false);
        }
      }
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [latitude, longitude, onAddressChange]);

  // Get current GPS location
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setIsGettingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const lat = result.coords.latitude;
        const lng = result.coords.longitude;

        onLocationChange(lat, lng);
        setIsGettingLocation(false);
      },
      (error) => {
        let message = "Unable to retrieve your location.";

        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission was denied. Please allow location access.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your current location is unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Please try again.";
        }

        setLocationError(message);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [onLocationChange]);

  return (
    <div className="space-y-3">
      {/* Map Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            Select Waste Location
          </p>

          <p className="text-xs text-gray-400">
            Click anywhere on the map to select a location.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isGettingLocation}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          <LocateFixed size={16} />

          {isGettingLocation
            ? "Getting Location..."
            : "Use My Current Location"}
        </button>
      </div>

      {/* Interactive Map */}
      <div className="relative z-0 h-[350px] w-full overflow-hidden rounded-2xl border border-gray-200">
        <LocationMap
          position={position}
          hasSelectedLocation={hasSelectedLocation}
          onLocationChange={onLocationChange}
        />
      </div>

      {/* GPS Error */}
      {locationError && <p className="text-xs text-red-500">{locationError}</p>}

      {/* Selected Location Information */}
      {hasSelectedLocation ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-600" />

          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-800">
              Location Selected
            </p>

            <p className="mt-1 break-all text-xs text-emerald-700">
              Latitude: {latitude!.toFixed(7)}
            </p>

            <p className="break-all text-xs text-emerald-700">
              Longitude: {longitude!.toFixed(7)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-600">
          Please select a point on the map or use your current location.
        </p>
      )}

      {/* Reverse Geocoding Status */}
      {isLoadingAddress && (
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          Retrieving address from selected coordinates...
        </div>
      )}

      {addressError && <p className="text-xs text-red-500">{addressError}</p>}
    </div>
  );
}
