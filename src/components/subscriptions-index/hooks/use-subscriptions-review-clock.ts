import { useEffect, useState } from "react";
import { getCurrentDate } from "@/lib/datetime";

const REVIEW_CLOCK_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function useSubscriptionsReviewClock(): Date {
  const [reviewClock, setReviewClock] = useState(() => getCurrentDate());

  useEffect(() => {
    const refreshReviewClock = () => {
      setReviewClock(getCurrentDate());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshReviewClock();
      }
    };

    const timerId = window.setInterval(refreshReviewClock, REVIEW_CLOCK_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return reviewClock;
}
