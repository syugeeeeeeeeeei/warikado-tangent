import type { CalculationLog, EventData } from '../types/domain';

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const saveEventDataAsJson = (eventData: EventData) => {
  const blob = new Blob([JSON.stringify(eventData, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `popsplit_${eventData.name || 'event'}.json`);
};

export const exportLogsAsCsv = (
  logs: CalculationLog[],
  getMemberName: (id: string) => string,
  eventName: string,
) => {
  let csv = 'メンバー名,精算項目,計算式,負担額,支払済,差引残高\n';
  logs.forEach((log) => {
    const memberName = getMemberName(log.memberId);
    csv += `"${memberName}","${log.expenseName}","${log.formula}",${log.amountOwed},${log.amountPaid},${log.net}\n`;
  });

  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, `popsplit_details_${eventName || 'event'}.csv`);
};

export const readEventDataFromJsonFile = (file: File): Promise<EventData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const raw = String(event.target?.result ?? '');
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'members' in parsed &&
          'expenses' in parsed
        ) {
          resolve(parsed as EventData);
          return;
        }
        reject(new Error('Invalid format'));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsText(file);
  });
};
