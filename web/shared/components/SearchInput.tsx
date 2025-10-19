import { Input } from "@/shadcn/ui/input"
import { Search } from "lucide-react"
import { KeyboardEvent, useState, useEffect, memo } from "react"

interface SearchInputProps {
  /**
   * Customizes the placeholder text in the search input field.
   * @default "Search..."
   */
  placeholder?: string;
  
  /**
   * The initial value of the search input. This is used to initialize the internal state.
   */
  initialValue?: string;
  
  /**
   * Callback function triggered when the search is submitted (e.g., Enter key press).
   * @param query The current search query string
   */
  onSubmit?: (query: string) => void;
  
  /**
   * CSS class name to apply to the container div
   */
  className?: string;
}

/**
 * A search input component that manages its own state and only triggers callbacks
 * when the user explicitly submits the search (e.g., by pressing Enter).
 * 
 * This component is memoized to prevent unnecessary re-renders of parent components
 * during typing.
 */
function SearchInputBase({
  placeholder = "Search...",
  initialValue = "",
  onSubmit,
  className = "py-4",
}: SearchInputProps) {
  // Internal state for the search input
  const [inputValue, setInputValue] = useState(initialValue);
  
  // Update internal state when initialValue prop changes (e.g., from URL parameters)
  useEffect(() => {
    if (initialValue !== undefined) {
      setInputValue(initialValue);
    }
  }, [initialValue]);
  
  // Handler for key down event on search input
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && onSubmit) {
      onSubmit(inputValue);
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-8 w-full"
        />
      </div>
    </div>
  );
}

/**
 * Memoized version of SearchInput to prevent re-renders when parent components change.
 * The component will only re-render when its props change.
 */
export const SearchInput = memo(SearchInputBase); 