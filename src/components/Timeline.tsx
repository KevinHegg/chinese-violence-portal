import React, { useState, useEffect } from 'react';

interface TimelineItem {
  id: number;
  date: string;
  title: string;
  description: string;
  eventType: string;
  link?: string;
}

interface ChartData {
  decade: string;
  violent: number;
  legal: number;
}

const Timeline: React.FC = () => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRs7Ox41PpOBoT4UM_pR7NbG9l5XabAFZdYxpIYLaoNkwlcs2LEVYb9xJAxzsyeG7UQQWhQ8MjzHt4L/pub?output=csv');
        const csvText = await response.text();
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const timelineItems: TimelineItem[] = [];
        
        // Process each line (skip header)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse CSV line (handle commas in quoted fields)
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim()); // Add last value
          
          // Extract data from CSV
          const year = values[0];
          const month = values[1].padStart(2, '0');
          const day = values[2].padStart(2, '0');
          const displayDate = values[3];
          const headline = values[4];
          const text = values[5];
          const eventType = values[6] || 'Legal & Policy'; // Event Type column
          const link = values[7]; // Link column
          
          // Create date string
          const dateStr = `${year}-${month}-${day}`;
          
          // Create timeline item
          const timelineItem: TimelineItem = {
            id: i,
            date: displayDate,
            title: headline,
            description: text,
            eventType: eventType,
            link: link || undefined
          };
          
          timelineItems.push(timelineItem);
        }
        
        // Sort by date
        timelineItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setItems(timelineItems);
        setLoading(false);
      } catch (err) {
        setError('Failed to load timeline data');
        setLoading(false);
        console.error('Error loading timeline data:', err);
      }
    };

    fetchTimelineData();
  }, []);

  const filteredItems = items.filter(item => {
    // Filter by event type
    if (selectedEventType !== 'all' && item.eventType !== selectedEventType) {
      return false;
    }
    
    // Filter by decade
    if (selectedDecade !== 'all') {
      const [startYear, endYear] = selectedDecade.split('-').map(Number);
      const itemYear = new Date(item.date).getFullYear();
      if (itemYear < startYear || itemYear > endYear) {
        return false;
      }
    }
    
    return true;
  });

  // Function to determine if an event should be on the left side
  const isLeftSideEvent = (eventType: string) => {
    return eventType.toLowerCase().includes('anti-chinese violence');
  };

  // Function to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timeline data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">Error Loading Timeline</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Filter Controls */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event Type:</label>
            <select 
              value={selectedEventType} 
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Event Types</option>
              <option value="Anti-Chinese Violence">Anti-Chinese Violence</option>
              <option value="Legal & Policy">Legal & Policy</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Time Period:</label>
            <select 
              value={selectedDecade} 
              onChange={(e) => setSelectedDecade(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Years (1850-1915)</option>
              <option value="1850-1869">1850-1869</option>
              <option value="1870-1889">1870-1889</option>
              <option value="1890-1909">1890-1909</option>
              <option value="1910-1915">1910-1915</option>
            </select>
          </div>
          <div>
            <button 
              onClick={() => {
                setSelectedEventType('all');
                setSelectedDecade('all');
              }}
              className="bg-accent text-white px-3 py-1 rounded text-xs hover:bg-accent-focus"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300 transform -translate-x-1/2"></div>
        
        {/* Timeline Items */}
        <div className="space-y-2">
          {filteredItems.map((item, index) => {
            const isLeftSide = isLeftSideEvent(item.eventType);
            
            return (
              <div key={item.id} className="relative flex items-start">
                {/* Timeline Dot */}
                <div className={`absolute left-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 ${
                  isLeftSide ? 'bg-red-500' : 'bg-blue-500'
                }`}></div>
                
                {/* Content Card - Positioned on left or right based on event type */}
                <div className={`w-6/12 ${
                  isLeftSide
                    ? 'mr-auto pr-3' // Left side for Anti-Chinese Violence events
                    : 'ml-auto pl-3'  // Right side for Legal & Policy events
                }`}>
                  <div className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow text-left`}>
                    <div className={`flex items-start justify-between mb-1 ${
                      isLeftSide
                        ? 'flex-row' // Date on left (closer to timeline), pill on right
                        : 'flex-row-reverse' // Date on right (closer to timeline), pill on left
                    }`}>
                      <div>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          isLeftSide
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.eventType}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{item.date}</span>
                    </div>
                    
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{decodeHtmlEntities(item.title)}</h3>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {decodeHtmlEntities(item.description)}
                      {item.link && (
                        <span className="ml-1">
                          <a 
                            href={item.link} 
                            className="text-accent hover:text-accent-focus underline"
                          >
                            (Read More)
                          </a>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No events match the selected filters.</p>
            <button 
              onClick={() => {
                setSelectedEventType('all');
                setSelectedDecade('all');
              }}
              className="mt-2 text-accent hover:text-accent-focus text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline; 