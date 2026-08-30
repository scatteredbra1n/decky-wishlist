import { staticClasses } from "@decky/ui";
import { definePlugin } from "@decky/api";
import { FaHeart } from "react-icons/fa";
import { WishlistPanel } from "./components/WishlistPanel";

export default definePlugin(() => {
  return {
    name: "Wishlist",
    titleView: <div className={staticClasses.Title}>Wishlist</div>,
    content: <WishlistPanel />,
    icon: <FaHeart />,
    onDismount() {
      // no-op
    },
  };
});
