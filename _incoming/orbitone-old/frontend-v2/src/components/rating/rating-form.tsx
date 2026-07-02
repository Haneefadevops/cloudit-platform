import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSubmitRating } from "@/hooks/useRating";
import { Star } from "lucide-react";

export interface RatingFormProps {
  profileId: string;
  customerId?: string;
  bookingId?: string;
  feedbackToken?: string;
  onSuccess?: () => void;
}

export function RatingForm({ profileId, customerId, bookingId, feedbackToken, onSuccess }: RatingFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [review, setReview] = useState("");
  const submit = useSubmitRating();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    await submit.mutateAsync({
      profileId,
      customerId,
      bookingId,
      rating,
      review: review.trim() || null,
      feedbackToken: feedbackToken ?? null,
    });
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="mb-2 block">How was your experience?</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="p-1 focus:outline-none"
              aria-label={`Rate ${star} out of 5`}
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  star <= (hover || rating) ? "fill-accent text-accent" : "text-border"
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="mt-1 text-sm text-muted">
            {rating} out of 5
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="review" className="mb-2 block">
          Review (optional)
        </Label>
        <Textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your feedback..."
          rows={4}
        />
      </div>

      {submit.isError && (
        <div className="rounded-lg border border-error bg-error/5 p-3 text-sm text-error">
          {submit.error?.message ?? "Could not submit rating."}
        </div>
      )}

      <Button type="submit" disabled={rating === 0 || submit.isPending} isLoading={submit.isPending}>
        Submit rating
      </Button>
    </form>
  );
}
