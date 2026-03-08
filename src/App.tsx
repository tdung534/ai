/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

// Declare Cropper globally since we load it via CDN
declare global {
  interface Window {
    Cropper: any;
  }
}

// Constants
const C_WIDTH = 1080;
const C_HEIGHT = 1440;

export default function App() {
  // Refs for Canvas
  const canvasLeftRef = useRef<HTMLCanvasElement>(null);
  const canvasRightRef = useRef<HTMLCanvasElement>(null);
  
  // Refs for Inputs
  const artistTextRef = useRef<HTMLInputElement>(null);
  const songTextRef = useRef<HTMLInputElement>(null);
  const lyricTextRef = useRef<HTMLTextAreaElement>(null);
  const uploadBgRef = useRef<HTMLInputElement>(null);
  const uploadFgRef = useRef<HTMLInputElement>(null);

  // Refs for Image Objects (to persist across renders without re-triggering effects unnecessarily)
  const imgBgRef = useRef<HTMLImageElement | null>(null);
  const imgFgRef = useRef<HTMLImageElement | null>(null);

  // State for UI Controls
  const [state, setState] = useState({
    bgDim: 40,
    bgBlur: 0,
    fgOpacity: 100,
    fgScale: 100,
    fgRadius: 24,
    artistSize: 34,
    songSize: 80,
    lyricSize: 29,
    lyricLineHeight: 49,
    lyricY: 747,
  });

  // State for Cropper Modal
  const [cropperModalOpen, setCropperModalOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');
  const [currentCropTarget, setCurrentCropTarget] = useState<'bg' | 'fg' | null>(null);
  const cropperInstanceRef = useRef<any>(null);
  const cropperImgRef = useRef<HTMLImageElement>(null);

  // State for Mobile Tabs
  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  
  // State for AI Loading
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [isGeneratingFg, setIsGeneratingFg] = useState(false);

  // Initialize Canvas
  useEffect(() => {
    const initCanvas = (canvas: HTMLCanvasElement) => {
      canvas.width = C_WIDTH;
      canvas.height = C_HEIGHT;
    };
    if (canvasLeftRef.current) initCanvas(canvasLeftRef.current);
    if (canvasRightRef.current) initCanvas(canvasRightRef.current);
    
    // Initial draw
    draw();
  }, []);

  // Draw Function
  const draw = () => {
    if (!canvasLeftRef.current || !canvasRightRef.current) return;
    const ctxL = canvasLeftRef.current.getContext('2d');
    const ctxR = canvasRightRef.current.getContext('2d');
    if (!ctxL || !ctxR) return;

    renderCanvas(ctxL, 0);
    renderCanvas(ctxR, 1);
  };

  // Re-draw when state changes
  useEffect(() => {
    draw();
  }, [state]);

  const renderCanvas = (ctx: CanvasRenderingContext2D, canvasIndex: number) => {
    // 1. Basic Black Fill
    ctx.clearRect(0, 0, C_WIDTH, C_HEIGHT);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, C_WIDTH, C_HEIGHT);

    // 2. Draw Background
    if (imgBgRef.current) {
      ctx.save();
      if (state.bgBlur > 0) {
        ctx.filter = `blur(${state.bgBlur}px)`;
      }
      drawSplitBg(ctx, imgBgRef.current, canvasIndex);
      ctx.restore();
    }
    // Dimming filter
    if (state.bgDim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${state.bgDim / 100})`;
      ctx.fillRect(0, 0, C_WIDTH, C_HEIGHT);
    }

    // 3. Draw Center Image
    const TotalWidth = C_WIDTH * 2;
    const globalCenterX = TotalWidth / 2;
    const globalCenterY = C_HEIGHT / 2;

    const baseFgWidth = 792;
    const baseFgHeight = 963;
    const currentFgWidth = baseFgWidth * (state.fgScale / 100);
    const currentFgHeight = baseFgHeight * (state.fgScale / 100);

    const boxX = globalCenterX - (currentFgWidth / 2);
    const boxY = globalCenterY - (currentFgHeight / 2);

    const offsetWidth = (canvasIndex === 0) ? 0 : C_WIDTH;
    const localBoxX = boxX - offsetWidth;

    ctx.save();
    ctx.globalAlpha = state.fgOpacity / 100;

    ctx.beginPath();
    // @ts-ignore - roundRect is standard now but TS might complain depending on lib version
    if (ctx.roundRect) {
        ctx.roundRect(localBoxX, boxY, currentFgWidth, currentFgHeight, state.fgRadius);
    } else {
        ctx.rect(localBoxX, boxY, currentFgWidth, currentFgHeight);
    }
    ctx.clip();

    if (imgFgRef.current) {
      drawFillInside(ctx, imgFgRef.current, localBoxX, boxY, currentFgWidth, currentFgHeight, 0, 0, 1);
    } else {
      ctx.fillStyle = '#374151';
      ctx.fillRect(localBoxX, boxY, currentFgWidth, currentFgHeight);
    }

    ctx.restore();

    // 3.5. Draw Text on Left Canvas
    if (canvasIndex === 0) {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const artistStr = artistTextRef.current?.value || "Mai Tiến Dũng";
      const songStr = songTextRef.current?.value || "NGƯỜI NHƯ ANH";
      const GAP = 15;

      const totalTextHeight = state.artistSize + state.songSize + GAP;
      const centralY = 606;
      const startArtistY = centralY - (totalTextHeight / 2) + (state.artistSize / 2);
      const startSongY = startArtistY + (state.artistSize / 2) + GAP + (state.songSize / 2);

      const artistX = 345;
      const songX = 345;

      ctx.font = `${state.artistSize}px "Tonos", sans-serif`;
      ctx.fillText(artistStr, artistX, startArtistY);

      ctx.font = `${state.songSize}px "Paraglide", sans-serif`;
      ctx.fillText(songStr, songX, startSongY);

      ctx.restore();
    }

    // 3.6. Draw Lyrics on Right Canvas
    if (canvasIndex === 1) {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${state.lyricSize}px "Athletic", sans-serif`;

      const lyricX = 442;
      const lyricString = lyricTextRef.current?.value || "";
      const lines = lyricString.split('\n');

      const totalTextHeight = (lines.length - 1) * state.lyricLineHeight;
      const startY = state.lyricY - (totalTextHeight / 2);

      for (let i = 0; i < lines.length; i++) {
        const currentY = startY + (i * state.lyricLineHeight);
        ctx.fillText(lines[i], lyricX, currentY);
      }

      ctx.restore();
    }
  };

  const drawSplitBg = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasIndex: number) => {
    const virtW = C_WIDTH * 2;
    const ratioImg = img.width / img.height;
    const ratioCanvas = virtW / C_HEIGHT;
    let drawW, drawH, drawX, drawY;

    if (ratioImg > ratioCanvas) {
      drawH = C_HEIGHT; drawW = drawH * ratioImg;
      drawY = 0; drawX = -(drawW - virtW) / 2;
    } else {
      drawW = virtW; drawH = drawW / ratioImg;
      drawX = 0; drawY = -(drawH - C_HEIGHT) / 2;
    }

    const offX = (canvasIndex === 0) ? 0 : C_WIDTH;
    ctx.drawImage(img, drawX - offX, drawY, drawW, drawH);
  };

  const drawFillInside = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, cw: number, ch: number, innerX: number, innerY: number, zoom: number) => {
    const ratioImg = img.width / img.height;
    const ratioCanvas = cw / ch;
    let drawW, drawH, drawX, drawY;

    if (ratioImg > ratioCanvas) {
      drawH = ch; drawW = drawH * ratioImg;
      drawY = y; drawX = x - (drawW - cw) / 2;
    } else {
      drawW = cw; drawH = drawW / ratioImg;
      drawX = x; drawY = y - (drawH - ch) / 2;
    }

    const newW = drawW * zoom;
    const newH = drawH * zoom;
    drawX = drawX - (newW - drawW) / 2 + innerX;
    drawY = drawY - (newH - drawH) / 2 + innerY;

    ctx.drawImage(img, drawX, drawY, newW, newH);
  };

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'bg' | 'fg') => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset input

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        openCropper(event.target.result as string, type);
      }
    };
    reader.readAsDataURL(file);
  };

  const openCropper = (imageSrc: string, type: 'bg' | 'fg') => {
    setCurrentCropTarget(type);
    setCropperImageSrc(imageSrc);
    setCropperModalOpen(true);
  };

  useEffect(() => {
    if (cropperModalOpen && cropperImgRef.current && currentCropTarget) {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
      }

      let aspectRatio = NaN;
      if (currentCropTarget === 'fg') {
        aspectRatio = 792 / 963;
      } else if (currentCropTarget === 'bg') {
        aspectRatio = 2160 / 1440;
      }

      // Use window.Cropper from CDN
      if (window.Cropper) {
        cropperInstanceRef.current = new window.Cropper(cropperImgRef.current, {
          aspectRatio: aspectRatio,
          viewMode: 1,
          autoCropArea: 1,
          background: false,
        });
      }
    }
  }, [cropperModalOpen, currentCropTarget]);

  const closeCropper = () => {
    setCropperModalOpen(false);
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
    }
  };

  const applyCrop = () => {
    if (!cropperInstanceRef.current || !currentCropTarget) return;

    const canvasData = cropperInstanceRef.current.getCroppedCanvas({
      width: currentCropTarget === 'fg' ? 792 : 2160,
      height: currentCropTarget === 'fg' ? 963 : 1440,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    const croppedDataUrl = canvasData.toDataURL('image/jpeg', 0.9);
    const newImg = new Image();
    newImg.onload = () => {
      if (currentCropTarget === 'bg') {
        imgBgRef.current = newImg;
      } else {
        imgFgRef.current = newImg;
      }
      draw();
      closeCropper();
    };
    newImg.src = croppedDataUrl;
  };

  const downloadImage = () => {
    if (!canvasLeftRef.current || !canvasRightRef.current) return;
    
    const link1 = document.createElement('a');
    link1.download = 'BanTrai.png';
    link1.href = canvasLeftRef.current.toDataURL('image/png');
    link1.click();

    setTimeout(() => {
      const link2 = document.createElement('a');
      link2.download = 'BanPhai.png';
      link2.href = canvasRightRef.current!.toDataURL('image/png');
      link2.click();
    }, 500);
  };

  // AI Generation
  const generateImage = async (type: 'bg' | 'fg' | 'both') => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert("Missing VITE_GEMINI_API_KEY. Please add it to your .env file or GitHub Secrets.");
      return;
    }

    if (type === 'bg') setIsGeneratingBg(true);
    else if (type === 'fg') setIsGeneratingFg(true);
    else {
      setIsGeneratingBg(true);
      setIsGeneratingFg(true);
    }

    const lyrics = lyricTextRef.current?.value || "";
    const song = songTextRef.current?.value || "";
    const artist = artistTextRef.current?.value || "";

    const prompt = `You are a professional photographer. Analyze the song lyrics and capture a PHOTOREALISTIC image that perfectly conveys the mood.
    
    Song: ${song} by ${artist}.
    Lyrics excerpt: "${lyrics.substring(0, 500)}..."

    VISUAL DIRECTION:
    - If the lyrics are SAD, LONELY, or HEARTBREAKING: Photograph a rainy window, a lonely park bench, a dark street at night, a gloomy sky, or a person standing alone in distance.
    - If the lyrics are ROMANTIC or LOVE: Photograph a couple holding hands (silhouette or from back), a sunset, a bouquet of flowers, or a warm cozy atmosphere.
    - If the lyrics are HAPPY or UPBEAT: Photograph a sunny beach, a blue sky, vibrant city lights, or nature in spring.
    
    STYLE REQUIREMENTS:
    - EXTREMELY REALISTIC.
    - Shot on 35mm film or high-end DSLR.
    - Natural lighting and textures.
    - NO text, NO words, NO abstract art, NO illustrations, NO CGI look, NO fake AI gloss.
    - The image should look like a high-quality stock photo from Pinterest or Unsplash.`;

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: prompt }]
        }
      });

      // Extract image from response
      let base64Image = null;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                base64Image = part.inlineData.data;
                break;
            }
        }
      }

      if (base64Image) {
        const imageUrl = `data:image/png;base64,${base64Image}`;
        
        // Load into Cropper to allow user to adjust or just auto-apply
        // For now, let's auto-apply to the canvas but via the Image object
        const newImg = new Image();
        newImg.onload = () => {
            if (type === 'bg') {
                imgBgRef.current = newImg;
            } else if (type === 'fg') {
                imgFgRef.current = newImg;
            } else {
                // Apply to both
                imgBgRef.current = newImg;
                imgFgRef.current = newImg;
            }
            draw();
        };
        newImg.src = imageUrl;
      } else {
          alert("No image generated. Please try again.");
      }

    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("Failed to generate image. See console for details.");
    } finally {
      if (type === 'bg') setIsGeneratingBg(false);
      else if (type === 'fg') setIsGeneratingFg(false);
      else {
        setIsGeneratingBg(false);
        setIsGeneratingFg(false);
      }
    }
  };

  return (
    <>
      <div className="sidebar">
        <div className="group">
          <label>Tải Ảnh Thiết Kế Của Bạn</label>
          
          <label className="upload-btn">
            Tải ảnh Nền (Background)
            <input type="file" ref={uploadBgRef} accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} />
          </label>
          <button 
            className="btn btn-ai flex items-center justify-center gap-2" 
            onClick={() => generateImage('bg')}
            disabled={isGeneratingBg}
          >
            {isGeneratingBg ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isGeneratingBg ? 'Đang tạo...' : 'Tạo ảnh Nền bằng AI'}
          </button>

          <button 
            className="btn btn-ai flex items-center justify-center gap-2" 
            onClick={() => generateImage('both')}
            disabled={isGeneratingBg || isGeneratingFg}
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}
          >
            {(isGeneratingBg || isGeneratingFg) ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {(isGeneratingBg || isGeneratingFg) ? 'Đang tạo...' : '✨ Tạo 1 ảnh cho cả 2 (Đồng bộ)'}
          </button>

          <div className="mt-4 border-t border-gray-700 pt-4">
             <label className="text-sm font-bold text-blue-400 mb-2 block">Hiệu ứng Ảnh Nền</label>
             <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Độ tối (Dim Overlay)</label>
                <div className="slider-row">
                  <input type="range" min="0" max="90" value={state.bgDim} onChange={(e) => setState({...state, bgDim: parseInt(e.target.value)})} />
                  <span className="val">{state.bgDim}</span>
                </div>
             </div>
             <div>
                <label className="text-xs text-gray-400 block mb-1">Độ nhòe (Blur)</label>
                <div className="slider-row">
                  <input type="range" min="0" max="50" value={state.bgBlur} onChange={(e) => setState({...state, bgBlur: parseInt(e.target.value)})} />
                  <span className="val">{state.bgBlur}</span>
                </div>
             </div>
          </div>

          <label className="upload-btn mt-4">
            Tải ảnh Giữa (Chính giữa 2 khung)
            <input type="file" ref={uploadFgRef} accept="image/*" onChange={(e) => handleFileChange(e, 'fg')} />
          </label>
          <button 
            className="btn btn-ai flex items-center justify-center gap-2" 
            onClick={() => generateImage('fg')}
            disabled={isGeneratingFg}
          >
            {isGeneratingFg ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isGeneratingFg ? 'Đang tạo...' : 'Tạo ảnh Giữa bằng AI'}
          </button>
        </div>

        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginTop: '5px', borderBottom: '1px solid #374151', paddingBottom: '5px' }}>
          Chỉnh Khối Ảnh Giữa
        </h3>

        <div className="group">
          <label>Phóng to/Thu nhỏ Ảnh Giữa (Kích thước)</label>
          <div className="slider-row">
            <input type="range" min="10" max="300" value={state.fgScale} onChange={(e) => setState({...state, fgScale: parseInt(e.target.value)})} />
            <span className="val">{state.fgScale}</span>
          </div>
        </div>
        <div className="group">
          <label>Độ Mờ Khối Ảnh Giữa</label>
          <div className="slider-row">
            <input type="range" min="10" max="100" value={state.fgOpacity} onChange={(e) => setState({...state, fgOpacity: parseInt(e.target.value)})} />
            <span className="val">{state.fgOpacity}</span>
          </div>
        </div>
        <div className="group">
          <label>Bo tròn phần dư (Xóa Nhòa Nhẹ)</label>
          <div className="slider-row">
            <input type="range" min="0" max="250" value={state.fgRadius} onChange={(e) => setState({...state, fgRadius: parseInt(e.target.value)})} />
            <span className="val">{state.fgRadius}</span>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', color: '#10b981', marginTop: '15px', borderBottom: '1px solid #374151', paddingBottom: '5px' }}>
          Chữ ca sĩ (Trái)
        </h3>

        <div className="group">
          <label>Tên Ca Sĩ</label>
          <input 
            type="text" 
            ref={artistTextRef}
            defaultValue="Mai Tiến Dũng"
            onChange={draw}
            style={{ width: '100%', padding: '8px', background: '#1f2937', border: '1px solid #374151', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <div className="group">
          <label>Cỡ chữ Ca Sĩ</label>
          <div className="slider-row">
            <input type="range" min="20" max="200" value={state.artistSize} onChange={(e) => setState({...state, artistSize: parseInt(e.target.value)})} />
            <span className="val">{state.artistSize}</span>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', color: '#10b981', marginTop: '15px', borderBottom: '1px solid #374151', paddingBottom: '5px' }}>
          Chữ bài hát (Trái)
        </h3>

        <div className="group">
          <label>Tên Bài Hát</label>
          <input 
            type="text" 
            ref={songTextRef}
            defaultValue="NGƯỜI NHƯ ANH"
            onChange={draw}
            style={{ width: '100%', padding: '8px', background: '#1f2937', border: '1px solid #374151', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <div className="group">
          <label>Cỡ chữ Bài Hát</label>
          <div className="slider-row">
            <input type="range" min="20" max="300" value={state.songSize} onChange={(e) => setState({...state, songSize: parseInt(e.target.value)})} />
            <span className="val">{state.songSize}</span>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', color: '#10b981', marginTop: '15px', borderBottom: '1px solid #374151', paddingBottom: '5px' }}>
          Lời bài hát (Phải)
        </h3>

        <div className="group">
          <label>Nội Dung Lời</label>
          <textarea 
            ref={lyricTextRef}
            rows={6}
            onChange={draw}
            defaultValue={`Chúng ta gần nhau mà như cách xa
Chúng ta gần nhau mà lòng băng giá
Tình yêu có phải khi ta chấp nhận
Rời xa để thấy yêu nhau nhiều hơn

Anh mong rằng em sẽ có một người
Yêu em cùng em đến hết cuộc đời
Một người mới luôn khiến em vui
Chẳng phải như anh chỉ làm em khóc

Nước mắt cho em đã quá đủ rồi
Nỗi xót xa em nhận lấy nhiều rồi
Xin lỗi anh không như những gì mà em mong
Một người như anh

Và anh biết rằng nơi trái tim em còn
Còn mong nhớ anh từng giờ
Nỗi đau anh biết rằng là
Thật khó để mình quên đi`}
            style={{ width: '100%', padding: '8px', background: '#1f2937', border: '1px solid #374151', color: 'white', borderRadius: '4px', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
          />
        </div>
        <div className="group">
          <label>Cỡ chữ Lời</label>
          <div className="slider-row">
            <input type="range" min="20" max="150" value={state.lyricSize} onChange={(e) => setState({...state, lyricSize: parseInt(e.target.value)})} />
            <span className="val">{state.lyricSize}</span>
          </div>
        </div>
        <div className="group">
          <label>Khoảng cách dòng (Line Height)</label>
          <div className="slider-row">
            <input type="range" min="20" max="150" value={state.lyricLineHeight} onChange={(e) => setState({...state, lyricLineHeight: parseInt(e.target.value)})} />
            <span className="val">{state.lyricLineHeight}</span>
          </div>
        </div>
        <div className="group">
          <label>Dịch lên/xuống (Y)</label>
          <div className="slider-row">
            <input type="range" min="0" max="1440" value={state.lyricY} onChange={(e) => setState({...state, lyricY: parseInt(e.target.value)})} />
            <span className="val">{state.lyricY}</span>
          </div>
        </div>

        <button className="btn btn-success" onClick={downloadImage}>⬇ Tải Xuống 2 Tấm Cuối</button>
      </div>

      <div className="main">
        <div className="mobile-tabs">
          <button className={`m-tab ${activeTab === 'left' ? 'active' : ''}`} onClick={() => setActiveTab('left')}>👁 Xem Ảnh Trái</button>
          <button className={`m-tab ${activeTab === 'right' ? 'active' : ''}`} onClick={() => setActiveTab('right')}>👁 Xem Ảnh Phải</button>
        </div>
        <div className="canvas-grid">
          <div className="canvas-wrapper" style={{ display: (window.innerWidth <= 768 && activeTab !== 'left') ? 'none' : 'block' }}>
            <canvas ref={canvasLeftRef}></canvas>
          </div>
          <div className="canvas-wrapper" style={{ display: (window.innerWidth <= 768 && activeTab !== 'right') ? 'none' : 'block' }}>
            <canvas ref={canvasRightRef}></canvas>
          </div>
        </div>
      </div>

      {cropperModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', 
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '80%', height: '80%', maxWidth: '800px', maxHeight: '600px', background: '#111', overflow: 'hidden' }}>
            <img ref={cropperImgRef} src={cropperImageSrc} style={{ display: 'block', maxWidth: '100%' }} alt="Crop target" />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
            <button className="btn" style={{ width: 'auto', padding: '10px 30px', background: '#4b5563' }} onClick={closeCropper}>Hủy</button>
            <button className="btn btn-success" style={{ width: 'auto', padding: '10px 30px' }} onClick={applyCrop}>Áp dụng Cắt</button>
          </div>
        </div>
      )}
    </>
  );
}


