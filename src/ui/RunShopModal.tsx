import { useState, type ReactElement } from "react";
import type { Friend, RunState } from "../types";
import { getItem } from "../config/items";
import { shopForLocation } from "../config/shops";
import { LOCATION_LABEL } from "../engine/locations";
import type { LocationId } from "../engine/locations";

export function RunShopModal(props: {
  state: RunState;
  location: LocationId;
  onBuy: (itemId: string, friendId?: string) => void;
  onClose: () => void;
}): ReactElement {
  const listings = shopForLocation(props.location);
  const [assignItem, setAssignItem] = useState<string | null>(null);
  const living = props.state.friends.filter((f) => f.status !== "dead");

  const canBuy = (itemId: string, kind: string): boolean => {
    const def = getItem(itemId);
    if (!def) return false;
    const listing = listings.find((l) => l.itemId === itemId);
    if (!listing || props.state.resources.caps < listing.price) return false;
    if (kind === "unique" && props.state.inventory.some((e) => e.itemId === itemId))
      return false;
    if (kind === "personal") {
      return living.some((f) => !f.memberItems.includes(itemId));
    }
    return true;
  };

  const buyPersonal = (itemId: string, friend: Friend) => {
    props.onBuy(itemId, friend.id);
    setAssignItem(null);
  };

  return (
    <div className="modal-overlay">
      <div className="panel modal-card shop-modal">
        <h2 style={{ marginTop: 0 }}>
          Biome market — {LOCATION_LABEL[props.location]}
        </h2>
        <p className="muted shop-caps-line">
          Your caps: <strong>{props.state.resources.caps}</strong>
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          Traders set up when you enter a new region. Personal gear must be assigned
          to one party member.
        </p>

        <ul className="shop-list">
          {listings.map((listing) => {
            const def = getItem(listing.itemId);
            if (!def) return null;
            const owned =
              def.kind === "unique"
                ? props.state.inventory.some((e) => e.itemId === listing.itemId)
                : def.kind === "personal"
                  ? !living.some((f) => !f.memberItems.includes(listing.itemId))
                  : false;

            return (
              <li key={listing.itemId} className="shop-list-item">
                <div className="shop-item-main">
                  <strong>{def.name}</strong>
                  <span className="muted"> — {def.description}</span>
                </div>
                <div className="shop-item-actions">
                  <span className="shop-price">{listing.price} caps</span>
                  {def.kind === "personal" ? (
                    assignItem === listing.itemId ? (
                      <div className="shop-assign-row">
                        {living.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="btn"
                            disabled={f.memberItems.includes(listing.itemId)}
                            onClick={() => buyPersonal(listing.itemId, f)}
                          >
                            {f.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setAssignItem(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canBuy(listing.itemId, def.kind)}
                        onClick={() => setAssignItem(listing.itemId)}
                      >
                        {owned ? "All equipped" : "Assign…"}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canBuy(listing.itemId, def.kind) || owned}
                      onClick={() => props.onBuy(listing.itemId)}
                    >
                      {owned ? "Owned" : "Buy"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button type="button" className="btn btn-primary" onClick={props.onClose}>
          Leave market
        </button>
      </div>
    </div>
  );
}
